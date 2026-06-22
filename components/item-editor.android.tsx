import React, { useCallback, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text as RNText, View, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Host,
  Column,
  Row,
  Card,
  Text,
  TextField,
  OutlinedTextField,
  FilledTonalButton,
  TextButton,
  IconButton,
  Switch,
  Checkbox,
  SingleChoiceSegmentedButtonRow,
  SegmentedButton,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { padding, paddingAll, fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { androidMaterial } from '@/constants/android-material';
import { DateField } from '@/components/ui/date-field.android';
import { SheetHeader, SheetHeaderIconButton } from '@/components/ui/sheet-header';
import {
  type ItemFormValues,
  emptyForm,
  itemToForm,
  formToItem,
} from '@/lib/item-form';
import { useThemeColors } from '@/constants/theme';
import { itemIdentity, ITEM_IDENTITY } from '@/lib/item-identity';
import { extractLinks } from '@/lib/links';
import { localDateString } from '@/lib/today';
import type { ChecklistItem, Item, ItemCategory } from '@/lib/schema';
import { beginLocationPick } from '@/lib/location-picker-store';
import { moveEntries, sanitizeChecklist } from '@/lib/checklist';
import { newId } from '@/lib/id';

// Android (Material 3 / Jetpack Compose) twin of components/item-editor.tsx. All
// shared logic — props, item-form usage, the category/time/checklist/location/save
// handlers and the lib calls — is identical to the iOS base; only the @expo/ui
// render tree diverges (ADR-0015). The SwiftUI Form + Sections become a Column of
// Material Cards. The iOS base is untouched — Metro resolves this on Android.

/** One choice in the Share editor's trip selector; `past` drives the visual marking. */
export interface TripOption {
  id: string;
  label: string;
  past: boolean;
}

export interface ItemEditorProps {
  itemId: string;
  initialItem?: Item;
  defaultCategory?: ItemCategory;
  trip?: { startDate: string; endDate: string };
  initialDate?: string;
  // When provided, the editor becomes the Share editor: a trip selector sits on
  // top of the form. The destination trip (and thus its date range / default
  // day) is owned by the parent, which re-supplies `trip` and `initialDate` when
  // the selection changes.
  tripOptions?: TripOption[];
  selectedTripId?: string;
  onSelectTrip?: (id: string) => void;
  onSubmit: (item: Item, date: string) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

const ALL_CATEGORIES = Object.keys(ITEM_IDENTITY) as ItemCategory[];

function parseLocalDate(s: string, hour = 12): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

function timeToDate(t: string): Date {
  const d = new Date();
  const m = t.match(/^(\d{2}):(\d{2})$/);
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function dateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// While the toggle is on, the Time row shows the value the way the locale would
// write it (e.g. "9:00 AM" or "09:00") next to the "Time" label.
function formatTime(t: string): string {
  return timeToDate(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function NoteLinks({ text }: { text: string }) {
  const c = useThemeColors();
  const m = androidMaterial(c);
  const links = useMemo(() => extractLinks(text), [text]);
  if (links.length === 0) return null;
  return (
    <Column>
      {links.map((link) => (
        <TextButton key={link.url} colors={m.textButton} onClick={() => void Linking.openURL(link.url).catch(() => {})}>
          <Text color={c.accent}>{link.label}</Text>
        </TextButton>
      ))}
    </Column>
  );
}

// The Time row carries the optional/"unset" state in its trailing Switch, exactly
// as the iOS Toggle did:
//   off            → no time, no picker
//   switching on   → defaults to 09:00, shows the value + picker
//   switching off  → clears the time
// Opening an existing timed item starts on, showing the value and picker.
function TimeRow({
  value,
  onToggle,
  onChange,
}: {
  value: string;
  onToggle: (on: boolean) => void;
  onChange: (v: string) => void;
}) {
  const c = useThemeColors();
  const m = androidMaterial(c);
  const on = value !== '';
  return (
    <Column verticalArrangement={{ spacedBy: 8 }}>
      <Row modifiers={[fillMaxWidth()]} horizontalArrangement="spaceBetween" verticalAlignment="center">
        <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
          <Text color={c.text}>Time</Text>
          {/* The value shows whenever the toggle is on, in the coral accent. */}
          {on ? <Text color={c.accent}>{formatTime(value)}</Text> : null}
        </Row>
        <Switch value={on} colors={m.switch} onCheckedChange={onToggle} />
      </Row>
      {on ? (
        <DateField
          label="At"
          mode="time"
          value={timeToDate(value)}
          onChange={(d) => onChange(dateToTime(d))}
        />
      ) : null}
    </Column>
  );
}

// One committed checklist entry. Its own component so each row gets its own native
// text state; keyed by entry id, so the state follows the entry through reorders.
// The leading Checkbox toggles `checked`; the field renames; the trailing controls
// move the entry up/down (via moveEntries) or delete it. Everything commits on
// Save like the rest of the form.
function ChecklistEntryRow({
  entry,
  position,
  count,
  onRename,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  entry: ChecklistItem;
  position: number;
  count: number;
  onRename: (label: string) => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const c = useThemeColors();
  const m = androidMaterial(c);
  const labelState = useNativeState(entry.label);
  return (
    <Row modifiers={[fillMaxWidth()]} horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
      <Checkbox value={entry.checked} colors={m.checkbox} onCheckedChange={onToggle} />
      <TextField value={labelState} colors={m.textField} onValueChange={onRename} modifiers={[weight(1)]}>
        <TextField.Placeholder>
          <Text>Checklist entry</Text>
        </TextField.Placeholder>
      </TextField>
      <IconButton onClick={onMoveUp} enabled={position > 1} colors={m.iconButton}>
        <Text>Move up</Text>
      </IconButton>
      <IconButton onClick={onMoveDown} enabled={position < count} colors={m.iconButton}>
        <Text>Move down</Text>
      </IconButton>
      <IconButton onClick={onDelete} colors={m.iconButton}>
        <Text>Delete entry {position}</Text>
      </IconButton>
    </Row>
  );
}

// The persistent "add entry" field. Keyed by the parent's composerKey so it
// remounts (re-seeding its native text blank) after each committed entry, the
// Compose-idiomatic way to clear a native field without mutating the hook value.
function ChecklistComposer({ onChange }: { onChange: (label: string) => void }) {
  const m = androidMaterial(useThemeColors());
  const textState = useNativeState('');
  return (
    <TextField value={textState} colors={m.textField} onValueChange={onChange} modifiers={[weight(1)]}>
      <TextField.Placeholder>
        <Text>Add entry</Text>
      </TextField.Placeholder>
    </TextField>
  );
}

function locationLabel(loc: Item['location'] | null): string {
  if (!loc) return 'Add location';
  if (loc.address) return loc.address;
  // Coords-only: show the pair truncated to 3 decimals (the stored value keeps
  // full precision).
  if (loc.lat != null && loc.lng != null) return `${loc.lat.toFixed(3)}, ${loc.lng.toFixed(3)}`;
  return 'Add location';
}

function LocationRow({
  location,
  onPick,
  onClear,
}: {
  location: Item['location'] | null;
  onPick: () => void;
  onClear: () => void;
}) {
  const c = useThemeColors();
  const m = androidMaterial(c);
  // Plain <Row>: an embedded IconSymbol grabs the row width under a Compose
  // Arrangement, so keep default start-placement here.
  return (
    <Row>
      <IconSymbol name={'map' as IconSymbolName} size={20} color={c.textSubtle} />
      <TextButton onClick={onPick} colors={m.textButton}>
        <Text color={c.accent}> {locationLabel(location)}</Text>
      </TextButton>
      {location ? (
        <IconButton onClick={onClear} colors={m.iconButton}>
          <Text>Clear location</Text>
        </IconButton>
      ) : null}
    </Row>
  );
}

export function ItemEditor({ itemId, initialItem, defaultCategory, trip, initialDate, tripOptions, selectedTripId, onSelectTrip, onSubmit, onDelete, onCancel }: ItemEditorProps) {
  const colorScheme = useColorScheme();
  const c = useThemeColors();
  const m = androidMaterial(c);
  // The item editor is a full-screen `modal` (app/trip/_layout.tsx), so on Android
  // it renders edge-to-edge from y=0 — the in-content header would sit under the
  // status bar without this top inset. iOS keeps the native modal nav bar
  // (item-editor.tsx), so this is Android-only.
  const insets = useSafeAreaInsets();
  const defaults = useMemo(
    () => (initialItem ? itemToForm(initialItem) : { ...emptyForm(), category: defaultCategory ?? 'activity' }),
    [initialItem, defaultCategory],
  );

  const [category, setCategory] = useState<ItemCategory>(defaults.category);
  const [date, setDate] = useState(initialDate ?? '');
  // Re-seed the day when the parent supplies a new default date — switching the
  // destination trip in the Share editor re-defaults the day to that trip.
  // Adjusting state during render (not in an effect) avoids an extra commit and
  // leaves the user's other in-progress edits untouched.
  const [seededDate, setSeededDate] = useState(initialDate);
  if (initialDate !== seededDate) {
    setSeededDate(initialDate);
    setDate(initialDate ?? '');
  }
  const [location, setLocation] = useState<Item['location'] | null>(initialItem?.location ?? null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialItem?.checklist ?? []);
  const identity = itemIdentity(category);

  // Name and notes are plain state: Name gates the Save button (disabled while
  // empty), and Notes drives the live link extraction below the field. The native
  // field text is bound through useNativeState so the field can be seeded and
  // edited natively; onValueChange mirrors it into React state.
  const nameState = useNativeState(defaults.name);
  const notesState = useNativeState(defaults.notes);
  const [name, setName] = useState(defaults.name);
  const [notes, setNotes] = useState(defaults.notes);

  // Time lives in plain state: '' means unset (toggle off).
  const [time, setTime] = useState(defaults.time);

  // The composer mirrors the typed draft into state so a half-typed entry can
  // still be saved without pressing "Add item" first. `composerKey` remounts the
  // field after a commit so it re-seeds blank (its native text resets natively).
  const [composerKey, setComposerKey] = useState(0);
  const [composerText, setComposerText] = useState('');

  const canSave = name.trim().length > 0;

  const submit = useCallback(() => {
    const values: ItemFormValues = { name, category, time, notes };
    // Fold in any draft sitting in the composer that was never added, so a
    // half-typed entry isn't silently dropped on Save.
    const pending = composerText.trim();
    const full = pending
      ? [...checklist, { id: newId(), label: pending, checked: false }]
      : checklist;
    onSubmit(formToItem(values, itemId, initialItem, location, sanitizeChecklist(full)), date);
  }, [name, category, time, notes, composerText, itemId, initialItem, location, checklist, date, onSubmit]);

  const heading = `${initialItem ? 'Edit' : 'New'} ${identity.label}`;

  function openLocationPicker() {
    // The picker opens blank every time (ADR-0012): it does not read the item's
    // current location, and cancelling leaves it untouched.
    beginLocationPick((loc) => setLocation(loc ?? null));
    router.push('/trip/location-picker');
  }

  function onTimeToggle(on: boolean) {
    setTime(on ? '09:00' : '');
  }

  // The "Add item" button commits the typed composer draft as an entry.
  const onAddEntry = useCallback(() => {
    const label = composerText.trim();
    if (!label) return;
    setChecklist((cl) => [...cl, { id: newId(), label, checked: false }]);
    setComposerText('');
    setComposerKey((k) => k + 1);
  }, [composerText]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* In-content Material header (react-native-screens drops the native
          header/Stack.Toolbar on Android formSheets). The title carries the
          category's accent + glyph, matching the iOS header. See SheetHeader. */}
      <SheetHeader
        titleNode={
          <View style={styles.titleRow}>
            <IconSymbol
              name={identity.symbol as IconSymbolName}
              color={identity.accent}
              size={18}
              style={styles.titleIcon}
            />
            <RNText style={[styles.titleText, { color: identity.accent }]} numberOfLines={1}>
              {heading}
            </RNText>
          </View>
        }
        left={
          onCancel ? (
            <SheetHeaderIconButton
              icon="xmark"
              accent={c.accent}
              accessibilityLabel="Cancel"
              onPress={onCancel}
            />
          ) : undefined
        }
        right={
          // Name-required validation is enforced here: Save is disabled while Name
          // is empty, so there is no section-footer error.
          <SheetHeaderIconButton
            icon="checkmark"
            accent={c.accent}
            accessibilityLabel="Save"
            prominent
            disabled={!canSave}
            onPress={submit}
          />
        }
      />

      {/* matchContents is vertical-only: full `matchContents` measures the
          ComposeView with unbounded width, which crashes the DateTimePicker's
          internal LazyRow ("infinity maximum width"). Matching height alone keeps
          the content auto-sizing while the width stays bounded by the flex layout. */}
      <Host
        style={styles.host}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        seedColor={c.accent}
        matchContents={{ vertical: true }}
      >
        <Column modifiers={[padding(16, 12, 16, 12)]} verticalArrangement={{ spacedBy: 16 }}>
          {/* Share editor only: the destination Trip picker sits at the very top. */}
          {tripOptions ? (
            <Card modifiers={[fillMaxWidth(), paddingAll(12)]} colors={m.card}>
              <Column verticalArrangement={{ spacedBy: 10 }}>
                <Text color={c.text}>Trip</Text>
                <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
                  {tripOptions.map((option) => (
                    <SegmentedButton
                      key={option.id}
                      selected={(selectedTripId ?? '') === option.id}
                      colors={m.segmented}
                      modifiers={[weight(1)]}
                      onClick={() => onSelectTrip?.(option.id)}
                    >
                      <SegmentedButton.Label>
                        <Text>{option.past ? `${option.label} · Past` : option.label}</Text>
                      </SegmentedButton.Label>
                    </SegmentedButton>
                  ))}
                </SingleChoiceSegmentedButtonRow>
              </Column>
            </Card>
          ) : null}

          {/* Combined title/notes card: Name over Notes, with extracted note links. */}
          <Card modifiers={[fillMaxWidth(), paddingAll(12)]} colors={m.card}>
            <Column verticalArrangement={{ spacedBy: 10 }}>
              <TextField value={nameState} colors={m.textField} onValueChange={setName} modifiers={[fillMaxWidth()]}>
                <TextField.Placeholder>
                  <Text>Title</Text>
                </TextField.Placeholder>
              </TextField>
              <OutlinedTextField value={notesState} colors={m.textField} onValueChange={setNotes} modifiers={[fillMaxWidth()]}>
                <OutlinedTextField.Placeholder>
                  <Text>Notes</Text>
                </OutlinedTextField.Placeholder>
              </OutlinedTextField>
              <NoteLinks text={notes} />
            </Column>
          </Card>

          {/* Category + Date / Time / Location detail card. */}
          <Card modifiers={[fillMaxWidth(), paddingAll(12)]} colors={m.card}>
            <Column verticalArrangement={{ spacedBy: 12 }}>
              <Text color={c.text}>Category</Text>
              <SingleChoiceSegmentedButtonRow modifiers={[fillMaxWidth()]}>
                {ALL_CATEGORIES.map((cat) => (
                  <SegmentedButton
                    key={cat}
                    selected={category === cat}
                    colors={m.segmented}
                    modifiers={[weight(1)]}
                    onClick={() => setCategory(cat)}
                  >
                    <SegmentedButton.Label>
                      <Text>{itemIdentity(cat).label}</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                ))}
              </SingleChoiceSegmentedButtonRow>

              {trip && date ? (
                <DateField
                  label="Date"
                  value={parseLocalDate(date)}
                  onChange={(d) => setDate(localDateString(d))}
                />
              ) : null}

              <TimeRow value={time} onToggle={onTimeToggle} onChange={setTime} />

              <LocationRow
                location={location}
                onPick={openLocationPicker}
                onClear={() => setLocation(null)}
              />
            </Column>
          </Card>

          {/* Checklist card. Each entry is a row; move buttons reuse moveEntries. */}
          <Card modifiers={[fillMaxWidth(), paddingAll(12)]} colors={m.card}>
            <Column verticalArrangement={{ spacedBy: 10 }}>
              <Text color={c.text}>Checklist</Text>
              {checklist.map((entry, i) => (
                <ChecklistEntryRow
                  key={entry.id}
                  entry={entry}
                  position={i + 1}
                  count={checklist.length}
                  onRename={(label) =>
                    setChecklist((cl) => cl.map((e) => (e.id === entry.id ? { ...e, label } : e)))
                  }
                  onToggle={() =>
                    setChecklist((cl) =>
                      cl.map((e) => (e.id === entry.id ? { ...e, checked: !e.checked } : e)),
                    )
                  }
                  onMoveUp={() => setChecklist((cl) => moveEntries(cl, [i], i - 1))}
                  onMoveDown={() => setChecklist((cl) => moveEntries(cl, [i], i + 2))}
                  onDelete={() =>
                    setChecklist((cl) => cl.filter((_, idx) => idx !== i))
                  }
                />
              ))}
              <Row modifiers={[fillMaxWidth()]} horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
                <ChecklistComposer key={composerKey} onChange={setComposerText} />
                <FilledTonalButton onClick={onAddEntry} colors={m.tonalButton}>
                  <Text>Add item</Text>
                </FilledTonalButton>
              </Row>
            </Column>
          </Card>

          {initialItem && onDelete ? (
            <Card modifiers={[fillMaxWidth(), paddingAll(12)]} colors={m.card}>
              <TextButton onClick={onDelete} colors={m.destructiveButton} modifiers={[fillMaxWidth()]}>
                <Text>Delete</Text>
              </TextButton>
            </Card>
          ) : null}
        </Column>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  host: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleIcon: { width: 18, height: 18 },
  titleText: { fontSize: 17, fontWeight: '600' },
});
