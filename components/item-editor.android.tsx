import React, { useCallback, useMemo, useState } from 'react';
import { Linking, StyleSheet, Text as RNText, View, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import {
  Host,
  Column,
  Row,
  Card,
  Text,
  TextField,
  OutlinedTextField,
  Button,
  TextButton,
  IconButton,
  Switch,
  Checkbox,
  DateTimePicker,
  SingleChoiceSegmentedButtonRow,
  SegmentedButton,
  useNativeState,
} from '@expo/ui/jetpack-compose';
import { padding, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
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
  const { accent } = useThemeColors();
  const links = useMemo(() => extractLinks(text), [text]);
  if (links.length === 0) return null;
  return (
    <Column>
      {links.map((link) => (
        <TextButton key={link.url} onClick={() => void Linking.openURL(link.url).catch(() => {})}>
          <Text color={accent}>{link.label}</Text>
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
  const { accent } = useThemeColors();
  const on = value !== '';
  return (
    <Column>
      <Row>
        <Text>Time</Text>
        {/* The value shows whenever the toggle is on, in the coral accent. */}
        {on ? <Text color={accent}>{formatTime(value)}</Text> : null}
        <Switch value={on} onCheckedChange={onToggle} />
      </Row>
      {on ? (
        <DateTimePicker
          initialDate={timeToDate(value).toISOString()}
          displayedComponents="hourAndMinute"
          onDateSelected={(d) => onChange(dateToTime(d))}
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
  const labelState = useNativeState(entry.label);
  return (
    <Row>
      <Checkbox value={entry.checked} onCheckedChange={onToggle} />
      <TextField value={labelState} onValueChange={onRename}>
        <TextField.Placeholder>
          <Text>Checklist entry</Text>
        </TextField.Placeholder>
      </TextField>
      <IconButton onClick={onMoveUp} enabled={position > 1}>
        <Text>Move up</Text>
      </IconButton>
      <IconButton onClick={onMoveDown} enabled={position < count}>
        <Text>Move down</Text>
      </IconButton>
      <IconButton onClick={onDelete}>
        <Text>Delete entry {position}</Text>
      </IconButton>
    </Row>
  );
}

// The persistent "add entry" field. Keyed by the parent's composerKey so it
// remounts (re-seeding its native text blank) after each committed entry, the
// Compose-idiomatic way to clear a native field without mutating the hook value.
function ChecklistComposer({ onChange }: { onChange: (label: string) => void }) {
  const textState = useNativeState('');
  return (
    <TextField value={textState} onValueChange={onChange}>
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
  const { accent, textSubtle } = useThemeColors();
  return (
    <Row>
      <IconSymbol name={'map' as IconSymbolName} size={20} color={textSubtle} />
      <TextButton onClick={onPick}>
        <Text color={accent}>{locationLabel(location)}</Text>
      </TextButton>
      {location ? (
        <IconButton onClick={onClear}>
          <Text>Clear location</Text>
        </IconButton>
      ) : null}
    </Row>
  );
}

export function ItemEditor({ itemId, initialItem, defaultCategory, trip, initialDate, tripOptions, selectedTripId, onSelectTrip, onSubmit, onDelete, onCancel }: ItemEditorProps) {
  const colorScheme = useColorScheme();
  const c = useThemeColors();
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
    <View style={styles.container}>
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
        matchContents={{ vertical: true }}
      >
        <Column modifiers={[padding(16, 12, 16, 12)]}>
          {/* Share editor only: the destination Trip picker sits at the very top. */}
          {tripOptions ? (
            <Card modifiers={[paddingAll(12)]}>
              <Column>
                <Text>Trip</Text>
                <SingleChoiceSegmentedButtonRow>
                  {tripOptions.map((option) => (
                    <SegmentedButton
                      key={option.id}
                      selected={(selectedTripId ?? '') === option.id}
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
          <Card modifiers={[paddingAll(12)]}>
            <Column>
              <TextField value={nameState} onValueChange={setName}>
                <TextField.Placeholder>
                  <Text>Title</Text>
                </TextField.Placeholder>
              </TextField>
              <OutlinedTextField value={notesState} onValueChange={setNotes}>
                <OutlinedTextField.Placeholder>
                  <Text>Notes</Text>
                </OutlinedTextField.Placeholder>
              </OutlinedTextField>
              <NoteLinks text={notes} />
            </Column>
          </Card>

          {/* Category + Date / Time / Location detail card. */}
          <Card modifiers={[paddingAll(12)]}>
            <Column>
              <Text>Category</Text>
              <SingleChoiceSegmentedButtonRow>
                {ALL_CATEGORIES.map((cat) => (
                  <SegmentedButton
                    key={cat}
                    selected={category === cat}
                    onClick={() => setCategory(cat)}
                  >
                    <SegmentedButton.Label>
                      <Text>{itemIdentity(cat).label}</Text>
                    </SegmentedButton.Label>
                  </SegmentedButton>
                ))}
              </SingleChoiceSegmentedButtonRow>

              {trip && date ? (
                <Row>
                  <Text>Date</Text>
                  <DateTimePicker
                    initialDate={parseLocalDate(date).toISOString()}
                    displayedComponents="date"
                    onDateSelected={(d) => setDate(localDateString(d))}
                  />
                </Row>
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
          <Card modifiers={[paddingAll(12)]}>
            <Column>
              <Text>Checklist</Text>
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
              <Row>
                <ChecklistComposer key={composerKey} onChange={setComposerText} />
                <Button onClick={onAddEntry}>
                  <Text>Add item</Text>
                </Button>
              </Row>
            </Column>
          </Card>

          {initialItem && onDelete ? (
            <Card modifiers={[paddingAll(12)]}>
              <Button onClick={onDelete}>
                <Text color={c.destructive}>Delete</Text>
              </Button>
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
