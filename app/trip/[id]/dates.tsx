import React, { useMemo, useState } from 'react';
import { Alert, useColorScheme } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Host, Form, Section, Text, DatePicker, Picker } from '@expo/ui/swift-ui';
import {
  background,
  datePickerStyle,
  font,
  foregroundStyle,
  listRowBackground,
  pickerStyle,
  scrollContentBackground,
  tag,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import {
  parseLocalDate,
  formatLocalDate,
  clampRange,
  addDays,
  daysBetween,
} from '@/lib/trip-form';
import { formatDayLabel } from '@/lib/date-utils';
import type { DateEditMode } from '@/lib/trip-days';
import { useDateEditStore } from '@/lib/date-edit-store';
import { useTripStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useThemeColors } from '@/constants/theme';

function SectionHeader({ children }: { children: string }) {
  return (
    <Text modifiers={[font({ design: 'rounded', weight: 'semibold', size: 15 })]}>{children}</Text>
  );
}

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
  const colorScheme = useColorScheme();
  const c = useThemeColors();

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
        t('dates.moveTitle'),
        t('dates.moveMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('dates.adjust'), onPress: stageAdjust },
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
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>{t('dates.title')}</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel={t('common.cancel')}
          tintColor={c.accent}
          onPress={() => router.back()}
        >
          {t('common.cancel')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={t('common.done')}
          variant="prominent"
          tintColor={c.accent}
          onPress={onDone}
        >
          {t('common.done')}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host
        style={{ flex: 1 }}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        modifiers={[tint(c.accent)]}
      >
        <Form modifiers={[scrollContentBackground('hidden'), background(c.background)]}>
          <Section
            header={<SectionHeader>{t('dates.changingHeader')}</SectionHeader>}
            footer={
              <Text modifiers={[font({ size: 13 }), foregroundStyle(c.textSubtle)]}>
                {mode === 'shift' ? t('dates.shiftFooter') : t('dates.adjustFooter')}
              </Text>
            }
            modifiers={[listRowBackground(c.surface)]}
          >
            <Picker
              selection={mode}
              onSelectionChange={(v) => setMode(v as DateEditMode)}
              modifiers={[pickerStyle('segmented')]}
            >
              <Text modifiers={[tag('shift')]}>{t('dates.shift')}</Text>
              <Text modifiers={[tag('adjust')]}>{t('dates.adjust')}</Text>
            </Picker>
          </Section>

          {mode === 'shift' ? (
            <Section
              header={<SectionHeader>{t('dates.newStartHeader')}</SectionHeader>}
              modifiers={[listRowBackground(c.surface)]}
            >
              <DatePicker
                title={t('common.start')}
                selection={parseLocalDate(shiftStart)}
                displayedComponents={['date']}
                onDateChange={(d) => setShiftStart(formatLocalDate(d))}
                modifiers={[datePickerStyle('compact')]}
              />
              <Text modifiers={[foregroundStyle(c.textSubtle)]}>{t('dates.endsOn', { date: formatDayLabel(shiftEnd) })}</Text>
            </Section>
          ) : (
            <Section
              header={<SectionHeader>{t('dates.newDatesHeader')}</SectionHeader>}
              modifiers={[listRowBackground(c.surface)]}
            >
              <DatePicker
                title={t('common.start')}
                selection={parseLocalDate(span.startDate)}
                displayedComponents={['date']}
                onDateChange={(d) => changeAdjust('start', d)}
                modifiers={[datePickerStyle('compact')]}
              />
              <DatePicker
                title={t('common.end')}
                selection={parseLocalDate(span.endDate)}
                displayedComponents={['date']}
                onDateChange={(d) => changeAdjust('end', d)}
                modifiers={[datePickerStyle('compact')]}
              />
            </Section>
          )}
        </Form>
      </Host>
    </>
  );
}
