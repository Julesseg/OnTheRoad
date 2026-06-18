import React, { useState } from 'react';
import { useColorScheme } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Host, Form, Section, Text, DatePicker, Button } from '@expo/ui/swift-ui';
import {
  background,
  datePickerStyle,
  font,
  foregroundStyle,
  listRowBackground,
  scrollContentBackground,
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
import { useThemeColors } from '@/constants/theme';

function SectionHeader({ children }: { children: string }) {
  return (
    <Text modifiers={[font({ design: 'rounded', weight: 'semibold', size: 15 })]}>{children}</Text>
  );
}

/**
 * The dedicated date-edit screen for an existing trip (ADR-0013). It opens on
 * the Shift / Adjust choice, then reveals the matching picker(s); confirming
 * *stages* the new span + mode back onto Edit Trip (it does not persist), so a
 * date change can never delete an Item.
 */
export default function TripDatesScreen() {
  const { startDate: initialStart, endDate: initialEnd } = useLocalSearchParams<{
    startDate: string;
    endDate: string;
  }>();
  const confirm = useDateEditStore((s) => s.confirm);
  const colorScheme = useColorScheme();
  const c = useThemeColors();

  const [mode, setMode] = useState<DateEditMode | null>(null);
  // Shift locks the duration: only the start moves, the end follows by the offset.
  const duration = daysBetween(initialStart, initialEnd);
  const [shiftStart, setShiftStart] = useState(initialStart);
  const shiftEnd = addDays(shiftStart, duration);
  // Adjust lets both ends move freely (start <= end).
  const [span, setSpan] = useState({ startDate: initialStart, endDate: initialEnd });

  function onConfirm() {
    if (mode === 'shift') {
      confirm({ startDate: shiftStart, endDate: shiftEnd, mode: 'shift' });
    } else if (mode === 'adjust') {
      confirm({ startDate: span.startDate, endDate: span.endDate, mode: 'adjust' });
    }
    router.back();
  }

  function changeAdjust(endpoint: 'start' | 'end', d: Date) {
    setSpan((cur) => clampRange(endpoint, formatLocalDate(d), cur));
  }

  return (
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>Trip dates</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel="Cancel"
          tintColor={c.accent}
          onPress={() => router.back()}
        >
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Done"
          variant="prominent"
          tintColor={c.accent}
          disabled={mode === null}
          onPress={onConfirm}
        >
          Done
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host
        style={{ flex: 1 }}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        modifiers={[tint(c.accent)]}
      >
        <Form modifiers={[scrollContentBackground('hidden'), background(c.background)]}>
          <Section
            header={<SectionHeader>How are these dates changing?</SectionHeader>}
            footer={
              <Text modifiers={[font({ size: 13 }), foregroundStyle(c.textSubtle)]}>
                {mode === 'shift'
                  ? 'Move the whole trip — every day keeps its plans, only the dates change.'
                  : mode === 'adjust'
                    ? 'Redefine the span — plans on days that fall outside move to the nearest day, never lost.'
                    : 'Shift moves the whole trip by an offset; Adjust redefines the span. Both keep every plan.'}
              </Text>
            }
            modifiers={[listRowBackground(c.surface)]}
          >
            <Button
              label="Shift the trip"
              systemImage={mode === 'shift' ? 'checkmark.circle.fill' : 'circle'}
              onPress={() => setMode('shift')}
            />
            <Button
              label="Adjust dates"
              systemImage={mode === 'adjust' ? 'checkmark.circle.fill' : 'circle'}
              onPress={() => setMode('adjust')}
            />
          </Section>

          {mode === 'shift' && (
            <Section
              header={<SectionHeader>New start date</SectionHeader>}
              modifiers={[listRowBackground(c.surface)]}
            >
              <DatePicker
                title="Start"
                selection={parseLocalDate(shiftStart)}
                displayedComponents={['date']}
                onDateChange={(d) => setShiftStart(formatLocalDate(d))}
                modifiers={[datePickerStyle('compact')]}
              />
              <Text modifiers={[foregroundStyle(c.textSubtle)]}>{`Ends ${formatDayLabel(shiftEnd)}`}</Text>
            </Section>
          )}

          {mode === 'adjust' && (
            <Section
              header={<SectionHeader>New dates</SectionHeader>}
              modifiers={[listRowBackground(c.surface)]}
            >
              <DatePicker
                title="Start"
                selection={parseLocalDate(span.startDate)}
                displayedComponents={['date']}
                onDateChange={(d) => changeAdjust('start', d)}
                modifiers={[datePickerStyle('compact')]}
              />
              <DatePicker
                title="End"
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
