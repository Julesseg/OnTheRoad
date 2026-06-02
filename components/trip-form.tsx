import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Host, DatePicker } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';

/** Format a Date as a local YYYY-MM-DD string (no UTC drift). */
function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** Parse a YYYY-MM-DD string into a local-midnight Date. */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

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
  const [title, setTitle] = useState(initialTitle);
  const [startDate, setStartDate] = useState(initialStartDate ?? today);
  const [endDate, setEndDate] = useState(initialEndDate ?? today);
  const [cover, setCover] = useState<TripFormCover>(
    initialWallpaperUri ? { kind: 'existing', displayUri: initialWallpaperUri } : { kind: 'none' },
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

  function handleSubmit() {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter a trip title.');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('Validation', 'End date must be on or after start date.');
      return;
    }
    onSubmit({ title: title.trim(), startDate, endDate, cover });
  }

  const coverPreviewUri =
    cover.kind === 'existing' ? cover.displayUri : cover.kind === 'picked' ? cover.uri : null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} accessibilityLabel="Cancel">
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.heading}>{heading}</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityLabel={submitLabel}
            >
              <Text style={[styles.save, submitting && styles.disabled]}>{submitLabel}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Pacific Coast Highway"
              autoFocus={autoFocusTitle}
              returnKeyType="done"
            />

            <Text style={styles.label}>Start Date</Text>
            <Host matchContents style={styles.picker}>
              <DatePicker
                selection={parseLocalDate(startDate)}
                displayedComponents={['date']}
                onDateChange={(d) => setStartDate(formatLocalDate(d))}
                modifiers={[datePickerStyle('graphical')]}
              />
            </Host>

            <Text style={styles.label}>End Date</Text>
            <Host matchContents style={styles.picker}>
              <DatePicker
                selection={parseLocalDate(endDate)}
                displayedComponents={['date']}
                onDateChange={(d) => setEndDate(formatLocalDate(d))}
                modifiers={[datePickerStyle('graphical')]}
              />
            </Host>

            <Text style={styles.label}>Cover Photo</Text>
            {coverPreviewUri ? (
              <View style={styles.coverWrap}>
                <Image
                  source={{ uri: coverPreviewUri }}
                  style={styles.coverPreview}
                  contentFit="cover"
                />
                <View style={styles.coverActions}>
                  <TouchableOpacity onPress={pickCover} accessibilityLabel="Change cover photo">
                    <Text style={styles.coverAction}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCover({ kind: 'none' })}
                    accessibilityLabel="Remove cover photo"
                  >
                    <Text style={[styles.coverAction, styles.coverRemove]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.coverButton}
                onPress={pickCover}
                accessibilityLabel="Add cover photo"
              >
                <Text style={styles.coverButtonText}>Add cover photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  heading: { fontSize: 17, fontWeight: '600' },
  cancel: { fontSize: 17, color: '#007AFF' },
  save: { fontSize: 17, color: '#007AFF', fontWeight: '600' },
  disabled: { opacity: 0.4 },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 20, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  picker: { alignSelf: 'stretch' },
  coverButton: {
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  coverButtonText: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
  coverWrap: { gap: 10 },
  coverPreview: { width: '100%', height: 160, borderRadius: 10 },
  coverActions: { flexDirection: 'row', gap: 20 },
  coverAction: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  coverRemove: { color: '#FF3B30' },
});
