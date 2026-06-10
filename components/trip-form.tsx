import React, { useState } from 'react';
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
import { datePickerStyle, font, frame, foregroundStyle } from '@expo/ui/swift-ui/modifiers';

import {
  tripFormSchema,
  type TripFormValues,
  formatLocalDate,
  parseLocalDate,
  clampRange,
} from '@/lib/trip-form';
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
  submitting = false,
  onSubmit,
  onCancel,
}: TripFormProps) {
  const today = formatLocalDate(new Date());
  const colorScheme = useColorScheme();
  const { destructive } = useThemeColors();
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
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>{heading}</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button accessibilityLabel="Cancel" onPress={onCancel}>
          Cancel
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel={submitLabel}
          variant="prominent"
          disabled={submitting}
          onPress={submit}
        >
          {submitLabel}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }} colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}>
        <Form>
          <Section header={<SectionHeader>What should we call it?</SectionHeader>} footer={<FieldError message={errors.title?.message} />}>
            <TextField
              text={titleState}
              placeholder="e.g. Pacific Coast Highway"
              autoFocus={autoFocusTitle}
              onTextChange={(t) => setValue('title', t)}
            />
          </Section>

          <Section header={<SectionHeader>When are you going?</SectionHeader>} footer={<FieldError message={errors.endDate?.message} />}>
            <DatePicker
              title="Start"
              selection={parseLocalDate(startDate)}
              displayedComponents={['date']}
              onDateChange={(d) => changeDate('start', d)}
              modifiers={[datePickerStyle('compact')]}
            />
            <DatePicker
              title="End"
              selection={parseLocalDate(endDate)}
              displayedComponents={['date']}
              onDateChange={(d) => changeDate('end', d)}
              modifiers={[datePickerStyle('compact')]}
            />
          </Section>

          <Section header={<SectionHeader>Cover photo</SectionHeader>}>
            {coverPreviewUri ? (
              <>
                <Image uiImage={coverPreviewUri} modifiers={[frame({ height: 160 })]} />
                <Button label="Change" systemImage="photo" onPress={pickCover} />
                <Button
                  label="Remove"
                  systemImage="trash"
                  role="destructive"
                  onPress={() => setCover({ kind: 'none' })}
                  modifiers={[foregroundStyle(destructive)]}
                />
              </>
            ) : (
              <Button label="Add cover photo" systemImage="photo.badge.plus" onPress={pickCover} />
            )}
          </Section>
        </Form>
      </Host>
    </>
  );
}
