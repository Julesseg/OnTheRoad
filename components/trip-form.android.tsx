import React, { useEffect, useState } from 'react';
import { Alert, Image, useColorScheme } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Host,
  Column,
  Card,
  Text,
  TextField,
  FilledTonalButton,
  OutlinedButton,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { padding, fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

import {
  tripFormSchema,
  type TripFormValues,
  formatLocalDate,
  clampRange,
} from '@/lib/trip-form';
import { formatDateRange } from '@/lib/date-utils';
import { useThemeColors, Spacing } from '@/constants/theme';
import { androidMaterial, androidHostTheme } from '@/constants/android-material';
import { DateField, ymdToLocalDate } from '@/components/ui/date-field.android';
import { SheetHeader, SheetHeaderIconButton } from '@/components/ui/sheet-header';
import { SheetScaffold } from '@/components/ui/sheet-scaffold';

// Android (Material 3) twin of trip-form.tsx. Same props, react-hook-form usage,
// zod schema, and handlers (changeDate / submit / pickCover) as the iOS source —
// only the render tree diverges: the SwiftUI Form + Sections + DatePickers become
// a Column of Material Cards with Compose TextField, DateTimePickers, and Buttons
// (ADR-0015). The base trip-form.tsx (iOS) is untouched — Metro resolves this
// variant on Android. The Cancel/Save chrome uses the in-content SheetHeader,
// since react-native-screens drops the native Stack.Toolbar on Android formSheets.

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

function FieldError({ message }: { message?: string }) {
  const { destructive } = useThemeColors();
  if (!message) return null;
  return <Text color={destructive}>{message}</Text>;
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
  const c = useThemeColors();
  const m = androidMaterial(c);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
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
        'Permission needed',
        'Allow photo library access to add a cover photo for this trip.',
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
    <SheetScaffold
      header={
        // In-content Material header (react-native-screens drops the native
        // header/Stack.Toolbar on Android formSheets). See SheetHeader.
        <SheetHeader
          title={heading}
          left={
            <SheetHeaderIconButton
              icon="xmark"
              accent={c.accent}
              accessibilityLabel="Cancel"
              onPress={onCancel}
            />
          }
          right={
            <SheetHeaderIconButton
              icon="checkmark"
              accent={c.accent}
              accessibilityLabel={submitLabel}
              prominent
              disabled={submitting}
              onPress={submit}
            />
          }
        />
      }
    >
      <Host matchContents={{ vertical: true }} {...androidHostTheme(c, scheme)}>
        <Column
          modifiers={[padding(Spacing.pageH, Spacing.pageV, Spacing.pageH, 0)]}
          verticalArrangement={{ spacedBy: Spacing.sectionGap }}
        >
          <Card modifiers={[fillMaxWidth(), paddingAll(Spacing.cardPad)]} colors={m.card}>
            <Column verticalArrangement={{ spacedBy: Spacing.rowGap }}>
              <TextField
                value={titleState}
                autoFocus={autoFocusTitle}
                isError={!!errors.title}
                colors={m.textField}
                onValueChange={(t) => setValue('title', t)}
                modifiers={[fillMaxWidth()]}
              >
                {/* The floating Label is the Material 3 text-field convention; it
                    doubles as the resting placeholder, so no separate Placeholder
                    slot (a duplicate "Title" once the label floats). Content must be
                    wrapped in <Text> — a bare string throws "Text strings must be
                    rendered within a <Text> component". */}
                <TextField.Label>
                  <Text>Title</Text>
                </TextField.Label>
              </TextField>
              {onEditDates ? (
                // Edit path: a single "Trip dates" row opens the Shift / Adjust
                // screen; the inline pickers are reserved for trip creation.
                <FilledTonalButton
                  onClick={() => onEditDates({ startDate, endDate })}
                  colors={m.tonalButton}
                  modifiers={[fillMaxWidth()]}
                >
                  <Text>{`Trip dates · ${formatDateRange(startDate, endDate)}`}</Text>
                </FilledTonalButton>
              ) : (
                // Create path: compact native date fields (tap → AOSP dialog),
                // replacing the full-height inline calendars.
                <>
                  <DateField
                    label="Start date"
                    value={ymdToLocalDate(startDate)}
                    onChange={(d) => changeDate('start', d)}
                  />
                  <DateField
                    label="End date"
                    value={ymdToLocalDate(endDate)}
                    onChange={(d) => changeDate('end', d)}
                  />
                </>
              )}
              <FieldError message={errors.title?.message} />
              <FieldError message={errors.endDate?.message} />
            </Column>
          </Card>

          <Card modifiers={[fillMaxWidth(), paddingAll(Spacing.cardPad)]} colors={m.card}>
            <Column verticalArrangement={{ spacedBy: Spacing.rowGap }}>
              <Text color={c.text} style={{ typography: 'titleSmall' }}>Cover photo</Text>
              {coverPreviewUri ? (
                <>
                  <Image
                    source={{ uri: coverPreviewUri }}
                    style={{ height: 160, width: '100%', borderRadius: 12 }}
                    resizeMode="cover"
                  />
                  <FilledTonalButton onClick={pickCover} colors={m.tonalButton} modifiers={[fillMaxWidth()]}>
                    <Text>Change</Text>
                  </FilledTonalButton>
                  <OutlinedButton onClick={() => setCover({ kind: 'none' })} colors={m.destructiveButton} modifiers={[fillMaxWidth()]}>
                    <Text>Remove</Text>
                  </OutlinedButton>
                </>
              ) : (
                <FilledTonalButton onClick={pickCover} colors={m.tonalButton} modifiers={[fillMaxWidth()]}>
                  <Text>Add cover photo</Text>
                </FilledTonalButton>
              )}
            </Column>
          </Card>
        </Column>
      </Host>
    </SheetScaffold>
  );
}
