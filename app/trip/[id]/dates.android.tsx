import React, { useMemo, useState } from 'react';
import { Alert, useColorScheme } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Host,
  Column,
  Card,
  Text,
  SingleChoiceSegmentedButtonRow,
  SegmentedButton,
} from '@expo/ui/jetpack-compose';
import { padding, paddingAll, fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';

import { formatLocalDate, clampRange, addDays, daysBetween } from '@/lib/trip-form';
import { formatDayLabel } from '@/lib/date-utils';
import type { DateEditMode } from '@/lib/trip-days';
import { useDateEditStore } from '@/lib/date-edit-store';
import { useTripStore } from '@/lib/store';
import { useThemeColors, Spacing } from '@/constants/theme';
import { androidMaterial, androidHostTheme } from '@/constants/android-material';
import { DateField, ymdToLocalDate } from '@/components/ui/date-field.android';
import { SheetHeader, SheetHeaderTextButton } from '@/components/ui/sheet-header';
import { SheetScaffold } from '@/components/ui/sheet-scaffold';

// Android (Material 3) twin of trip/[id]/dates.tsx. Same store/router/date-edit
// wiring and the same Shift/Adjust mode logic (ADR-0013, ADR-0015); the SwiftUI
// Form + segmented Picker + DatePickers become a Column of Material Cards with a
// single-choice segmented button row and Material DateTimePickers. The base
// dates.tsx (iOS) is untouched — Metro resolves this variant on Android.

const MODES: DateEditMode[] = ['shift', 'adjust'];
const MODE_LABELS: Record<DateEditMode, string> = {
  shift: 'Shift the trip',
  adjust: 'Adjust dates',
};

/**
 * The dedicated date-edit screen for an existing trip (ADR-0013). A segmented
 * control picks Shift vs Adjust, then the matching picker(s) appear; confirming
 * *stages* the new span + mode back onto Edit Trip (it does not persist), so a
 * date change can never delete an Item. Adjust confirms with a heads-up alert
 * when it would relocate items off out-of-window days.
 */
export default function TripDatesScreen() {
  const {
    id,
    startDate: initialStart,
    endDate: initialEnd,
  } = useLocalSearchParams<{ id: string; startDate: string; endDate: string }>();
  const confirm = useDateEditStore((s) => s.confirm);
  const trip = useTripStore((s) => s.loadedTrips[id]);
  const c = useThemeColors();
  const m = androidMaterial(c);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';

  const [mode, setMode] = useState<DateEditMode>('shift');
  // Shift locks the duration: only the start moves, the end follows by the offset.
  const duration = daysBetween(initialStart, initialEnd);
  const [shiftStart, setShiftStart] = useState(initialStart);
  const shiftEnd = addDays(shiftStart, duration);
  // Adjust lets both ends move freely (start <= end).
  const [span, setSpan] = useState({ startDate: initialStart, endDate: initialEnd });

  // How many items sit on days that Adjust would push out of the window — they
  // are relocated to the nearest edge, never dropped, but the user is warned.
  const itemsToMove = useMemo(() => {
    if (!trip) return 0;
    return trip.days
      .filter((d) => d.date < span.startDate || d.date > span.endDate)
      .reduce((n, d) => n + d.items.length, 0);
  }, [trip, span.startDate, span.endDate]);

  function stageShift() {
    confirm({ startDate: shiftStart, endDate: shiftEnd, mode: 'shift' });
    router.back();
  }

  function stageAdjust() {
    confirm({ startDate: span.startDate, endDate: span.endDate, mode: 'adjust' });
    router.back();
  }

  function onDone() {
    if (mode === 'shift') {
      stageShift();
      return;
    }
    if (itemsToMove > 0) {
      Alert.alert(
        'Move items to fit?',
        'Some days fall outside the new dates. Their plans are kept, not deleted — anything before the new start moves to the end of the first day, and anything after the new end moves to the end of the last day.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Adjust dates', onPress: stageAdjust },
        ],
      );
      return;
    }
    stageAdjust();
  }

  function changeAdjust(endpoint: 'start' | 'end', d: Date) {
    setSpan((cur) => clampRange(endpoint, formatLocalDate(d), cur));
  }

  return (
    <SheetScaffold
      header={
        // In-content Material header (react-native-screens drops the native
        // header/Stack.Toolbar on Android formSheets). See SheetHeader.
        <SheetHeader
          title="Trip dates"
          left={
            <SheetHeaderTextButton label="Cancel" accent={c.accent} onPress={() => router.back()} />
          }
          right={<SheetHeaderTextButton label="Done" accent={c.accent} prominent onPress={onDone} />}
        />
      }
    >
      {/* matchContents is vertical-only: full `matchContents` measures the
          ComposeView with unbounded width, which crashes the DateTimePicker's
          internal LazyRow ("infinity maximum width"). Matching height alone keeps
          the content auto-sizing while the width stays bounded by the flex layout. */}
      <Host matchContents={{ vertical: true }} {...androidHostTheme(c, scheme)}>
        <Column
          modifiers={[padding(Spacing.pageH, Spacing.pageV, Spacing.pageH, 0)]}
          verticalArrangement={{ spacedBy: Spacing.sectionGap }}
        >
          <Card modifiers={[fillMaxWidth(), paddingAll(Spacing.cardPad)]} colors={m.card}>
            <Column verticalArrangement={{ spacedBy: Spacing.rowGap }}>
              <Text color={c.text} style={{ typography: 'titleSmall' }}>How are these dates changing?</Text>
              <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
                {MODES.map((mo) => (
                  <SegmentedButton
                    key={mo}
                    selected={mode === mo}
                    colors={m.segmented}
                    modifiers={[weight(1)]}
                    onClick={() => setMode(mo)}
                  >
                    <SegmentedButton.Label>
                      <Text>{MODE_LABELS[mo]}</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                ))}
              </SingleChoiceSegmentedButtonRow>
              <Text color={c.textSubtle} style={{ typography: 'bodySmall' }}>
                {mode === 'shift'
                  ? 'Move the whole trip — every day keeps its plans, only the dates change.'
                  : 'Redefine the span — plans on days that fall outside move to the nearest day, never lost.'}
              </Text>
            </Column>
          </Card>

          {mode === 'shift' ? (
            <Card modifiers={[fillMaxWidth(), paddingAll(Spacing.cardPad)]} colors={m.card}>
              <Column verticalArrangement={{ spacedBy: Spacing.rowGap }}>
                <DateField
                  label="New start date"
                  value={ymdToLocalDate(shiftStart)}
                  onChange={(d) => setShiftStart(formatLocalDate(d))}
                />
                <Text color={c.textSubtle} style={{ typography: 'bodySmall' }}>{`Ends ${formatDayLabel(shiftEnd)}`}</Text>
              </Column>
            </Card>
          ) : (
            <Card modifiers={[fillMaxWidth(), paddingAll(Spacing.cardPad)]} colors={m.card}>
              <Column verticalArrangement={{ spacedBy: Spacing.rowGap }}>
                <Text color={c.text} style={{ typography: 'titleSmall' }}>New dates</Text>
                <DateField
                  label="Start"
                  value={ymdToLocalDate(span.startDate)}
                  onChange={(d) => changeAdjust('start', d)}
                />
                <DateField
                  label="End"
                  value={ymdToLocalDate(span.endDate)}
                  onChange={(d) => changeAdjust('end', d)}
                />
              </Column>
            </Card>
          )}
        </Column>
      </Host>
    </SheetScaffold>
  );
}
