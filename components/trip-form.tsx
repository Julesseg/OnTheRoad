import React, { useEffect, useState } from 'react';
import { Alert, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Host,
  Form,
  Section,
  Text,
  TextField,
  DatePicker,
  Button,
  Image,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  aspectRatio,
  background,
  clipped,
  datePickerStyle,
  font,
  frame,
  foregroundStyle,
  listRowBackground,
  resizable,
  scrollContentBackground,
  tint,
} from '@expo/ui/swift-ui/modifiers';

import {
  tripFormSchema,
  type TripFormValues,
  formatLocalDate,
  parseLocalDate,
  clampRange,
} from '@/lib/trip-form';
import { formatDateRange } from '@/lib/date-utils';
import { t } from '@/lib/i18n';
import { useThemeColors } from '@/constants/theme';

/** The trip's cover photo as the form currently holds it. `existing` is an
 * already-saved wallpaper (shown by its display uri), `picked` is a freshly
 * chosen local image awaiting save, and `none` means no cover. */
export type TripFormCover =
  | { kind: 'existing'; displayUri: string }
  | { kind: 'picked'; uri: string }
  | { kind: 'none' };

export interface TripFormResult {
  title: string;
  startDate: string;
  endDate: string;
  cover: TripFormCover;
}

export interface TripFormProps {
  heading: string;
  submitLabel: string;
  initialTitle?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  /** Display uri (file://) of an existing wallpaper, if any. */
  initialWallpaperUri?: string;
  /** Focus the title field on mount so the keyboard opens immediately (create). */
  autoFocusTitle?: boolean;
  /** Edit path: when set, the inline date pickers become a single "Trip dates"
   * row showing the current span. Tapping it opens the Shift / Adjust date
   * screen; the staged span flows back in via `initialStartDate`/`initialEndDate`
   * so a date change never deletes an Item (ADR-0013). Absent → inline pickers. */
  onEditDates?: (current: { startDate: string; endDate: string }) => void;
  submitting?: boolean;
  onSubmit: (result: TripFormResult) => void;
  onCancel: () => void;
}

/** Warm, rounded-font section header (matches the native-form direction of ADR-0003). */
function SectionHeader({ children }: { children: string }) {
  return (
    <Text modifiers={[font({ design: 'rounded', weight: 'semibold', size: 15 })]}>{children}</Text>
  );
}

function FieldError({ message }: { message?: string }) {
  const { destructive } = useThemeColors();
  if (!message) return null;
  return <Text modifiers={[font({ size: 13 }), foregroundStyle(destructive)]}>{message}</Text>;
}

export function TripForm({
  heading,
  submitLabel,
  initialTitle = '',
  initialStartDate,
  initialEndDate,
  initialWallpaperUri,
  autoFocusTitle = false,
  onEditDates,
  submitting = false,
  onSubmit,
  onCancel,
}: TripFormProps) {
  const today = formatLocalDate(new Date());
  const colorScheme = useColorScheme();
  const c = useThemeColors();
  // Native two-way binding seeds the field's initial text (edit path); the
  // mirror into react-hook-form below keeps validation in sync.
  const titleState = useNativeState(initialTitle);
  const [cover, setCover] = useState<TripFormCover>(
    initialWallpaperUri ? { kind: 'existing', displayUri: initialWallpaperUri } : { kind: 'none' },
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      title: initialTitle,
      startDate: initialStartDate ?? today,
      endDate: initialEndDate ?? today,
    },
    mode: 'onSubmit',
  });

  const startDate = useWatch({ control, name: 'startDate' });
  const endDate = useWatch({ control, name: 'endDate' });

  // Edit path only: the date screen stages the new span by updating the
  // initial-date props, so mirror them into the form's values when they change
  // (create manages its own dates through the inline pickers below).
  useEffect(() => {
    if (!onEditDates) return;
    if (initialStartDate) setValue('startDate', initialStartDate);
    if (initialEndDate) setValue('endDate', initialEndDate);
  }, [initialStartDate, initialEndDate, onEditDates, setValue]);

  // Each calendar drives one endpoint; moving it past the other drags that other
  // one along so the range stays valid (start <= end).
  function changeDate(endpoint: 'start' | 'end', d: Date) {
    const next = clampRange(endpoint, formatLocalDate(d), { startDate, endDate });
    setValue('startDate', next.startDate);
    setValue('endDate', next.endDate);
  }

  const submit = handleSubmit((data) =>
    onSubmit({ title: data.title, startDate: data.startDate, endDate: data.endDate, cover }),
  );

  async function pickCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t('tripForm.permissionTitle'),
        t('tripForm.permissionMessage'),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (uri) setCover({ kind: 'picked', uri });
  }

  const coverPreviewUri =
    cover.kind === 'existing' ? cover.displayUri : cover.kind === 'picked' ? cover.uri : null;

  return (
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>{heading}</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel={t('common.cancel')}
          icon="xmark"
          tintColor={c.accent}
          onPress={onCancel}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={submitLabel}
          icon="checkmark"
          variant="prominent"
          tintColor={c.accent}
          disabled={submitting}
          onPress={submit}
        />
      </Stack.Toolbar>

      {/* tint() seeds the SwiftUI accent for everything in the Host (buttons,
          date pickers, cursors) — SwiftUI otherwise falls back to system blue.
          The Form swaps its system grouped background for the warm theme bg,
          and each Section paints its rows with the theme surface. */}
      <Host
        style={{ flex: 1 }}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        // Let the SwiftUI content (and its themed Form background below) extend
        // through the keyboard safe area. Otherwise the hosting view shrinks to
        // above the keyboard when the title field is focused and its uncovered
        // system backing shows as a white band behind the keys.
        ignoreSafeArea="keyboard"
        modifiers={[tint(c.accent)]}
      >
        <Form modifiers={[scrollContentBackground('hidden'), background(c.background)]}>
          <Section
            footer={
              <>
                <FieldError message={errors.title?.message} />
                <FieldError message={errors.endDate?.message} />
              </>
            }
            modifiers={[listRowBackground(c.surface)]}
          >
            <TextField
              text={titleState}
              placeholder={t('tripForm.titlePlaceholder')}
              autoFocus={autoFocusTitle}
              onTextChange={(t) => setValue('title', t)}
            />
            {onEditDates ? (
              // Edit path: a single "Trip dates" row opens the Shift / Adjust
              // screen; the inline pickers are reserved for trip creation.
              <Button
                label={t('tripForm.datesLabel', { range: formatDateRange(startDate, endDate) })}
                systemImage="calendar"
                onPress={() => onEditDates({ startDate, endDate })}
              />
            ) : (
              <>
                <DatePicker
                  title={t('common.start')}
                  selection={parseLocalDate(startDate)}
                  displayedComponents={['date']}
                  onDateChange={(d) => changeDate('start', d)}
                  modifiers={[datePickerStyle('compact')]}
                />
                <DatePicker
                  title={t('common.end')}
                  selection={parseLocalDate(endDate)}
                  displayedComponents={['date']}
                  onDateChange={(d) => changeDate('end', d)}
                  modifiers={[datePickerStyle('compact')]}
                />
              </>
            )}
          </Section>

          <Section
            header={<SectionHeader>{t('tripForm.coverPhoto')}</SectionHeader>}
            modifiers={[listRowBackground(c.surface)]}
          >
            {coverPreviewUri ? (
              <>
                {/* Without resizable() the SwiftUI Image renders at the photo's
                    native pixel size, so a fixed frame just clips a tiny center
                    crop (looks heavily zoomed). resizable + aspectRatio fill
                    scales it to fill the 160pt-tall row, then clipped() trims
                    the overflow. */}
                <Image
                  uiImage={coverPreviewUri}
                  modifiers={[
                    resizable(),
                    aspectRatio({ contentMode: 'fill' }),
                    frame({ height: 160 }),
                    clipped(),
                  ]}
                />
                <Button label={t('tripForm.change')} systemImage="photo" onPress={pickCover} />
                <Button
                  label={t('tripForm.remove')}
                  systemImage="trash"
                  role="destructive"
                  onPress={() => setCover({ kind: 'none' })}
                  modifiers={[foregroundStyle(c.destructive)]}
                />
              </>
            ) : (
              <Button label={t('tripForm.addCoverPhoto')} systemImage="photo.badge.plus" onPress={pickCover} />
            )}
          </Section>
        </Form>
      </Host>
    </>
  );
}
