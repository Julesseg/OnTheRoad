import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text as RNText, View, useColorScheme } from 'react-native';
import { Stack, router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Host,
  Form,
  Section,
  Text,
  TextField,
  DatePicker,
  Picker,
  Button,
  Image,
  HStack,
  VStack,
  LabeledContent,
  List,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  datePickerStyle,
  pickerStyle,
  tag,
  accessibilityLabel,
  multilineTextAlignment,
  labelsHidden,
  background,
  frame,
  lineLimit,
  listRowBackground,
  scrollContentBackground,
  tint,
  truncationMode,
  onTapGesture,
  contentTransition,
  animation,
  Animation,
} from '@expo/ui/swift-ui/modifiers';

import {
  type ItemFormValues,
  emptyForm,
  itemToForm,
  formToItem,
  itemFormSchema,
} from '@/lib/item-form';
import { useThemeColors } from '@/constants/theme';
import { itemIdentity, ITEM_IDENTITY } from '@/lib/item-identity';
import { extractLinks } from '@/lib/links';
import { localDateString } from '@/lib/today';
import type { ChecklistItem, Item, ItemCategory } from '@/lib/schema';
import { beginLocationPick } from '@/lib/location-picker-store';
import {
  ENTRY_SENTINEL,
  type ChecklistFocus,
  mergeEntryUp,
  moveEntries,
  sanitizeChecklist,
  splitEntry,
} from '@/lib/checklist';
import type { TextFieldRef } from '@expo/ui/swift-ui';
import { newId } from '@/lib/id';

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

// Native form rows label themselves; when a field is invalid we tint its
// leading label red to match the error message in the section footer.
function fieldLabel(label: string, error: string | undefined, errColor: string): string | React.ReactNode {
  return error ? <Text modifiers={[foregroundStyle(errColor)]}>{label}</Text> : label;
}

function FieldError({ message }: { message?: string }) {
  const { destructive } = useThemeColors();
  if (!message) return null;
  return <Text modifiers={[font({ size: 13 }), foregroundStyle(destructive)]}>{message}</Text>;
}

function NoteLinks({ text }: { text: string }) {
  const { accent } = useThemeColors();
  const links = useMemo(() => extractLinks(text), [text]);
  if (links.length === 0) return null;
  return (
    <VStack alignment="leading" spacing={6}>
      {links.map((link) => (
        <HStack
          key={link.url}
          spacing={6}
          modifiers={[
            frame({ maxWidth: Infinity, alignment: 'leading' }),
            accessibilityLabel(`Open ${link.label}`),
            onTapGesture(() => {
              void Linking.openURL(link.url).catch(() => {});
            }),
          ]}
        >
          <Image systemName="link" color={accent} size={13} />
          <Text modifiers={[font({ size: 14 }), foregroundStyle(accent)]}>{link.label}</Text>
        </HStack>
      ))}
    </VStack>
  );
}

function TimeRow({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const { textSubtle, destructive } = useThemeColors();
  if (!value) {
    return (
      <LabeledContent label={fieldLabel('Time', error, destructive)}>
        <Button label="Add time" onPress={() => onChange('09:00')} />
      </LabeledContent>
    );
  }
  return (
    // The clear control is an Image with a tap gesture, not a Button — iOS 26
    // permanently drops the row's bottom separator when the row contains a
    // button, and listRowSeparator('visible') cannot override that.
    <LabeledContent label={fieldLabel('Time', error, destructive)}>
      <HStack spacing={8}>
        <DatePicker
          title="Time"
          selection={timeToDate(value)}
          displayedComponents={['hourAndMinute']}
          onDateChange={(d) => onChange(dateToTime(d))}
          modifiers={[datePickerStyle('compact'), labelsHidden()]}
        />
        <Image
          systemName="xmark.circle.fill"
          color={textSubtle}
          size={20}
          modifiers={[accessibilityLabel('Clear time'), onTapGesture(() => onChange(''))]}
        />
      </HStack>
    </LabeledContent>
  );
}

// One editable checklist entry. Its own component so each row gets its own
// native text state; keyed by entry id, so the state follows the entry through
// reorders. The leading circle toggles `checked` (animating into a filled
// checkmark); everything commits on Save like the rest of the form. Removal is
// the system swipe-to-delete and reorder the system long-press drag — both
// wired on the surrounding List.ForEach, not here.
//
// The rows behave like lines in a paragraph. The native text always carries a
// leading sentinel (see `ENTRY_SENTINEL`) so we can read three intents out of a
// single `onTextChange`:
//   - text lost its sentinel  → backspace at offset 0 → merge into the row above
//   - text gained a newline   → Return → split, the tail moving to a new row
//   - anything else           → an ordinary rename
// Using the text stream (rather than SwiftUI's `.onSubmit`, which resigns the
// keyboard) is what lets Return move the caret to the next row without the
// keyboard dropping and springing back. Focus and caret placement after a
// split/merge are driven imperatively by the parent through `registerRef`.
function ChecklistEntryRow({
  entry,
  position,
  isFirst,
  registerRef,
  onRename,
  onToggle,
  onSplit,
  onMergeUp,
}: {
  entry: ChecklistItem;
  position: number;
  isFirst: boolean;
  registerRef: (id: string, ref: TextFieldRef | null) => void;
  onRename: (id: string, label: string) => void;
  onToggle: () => void;
  onSplit: (id: string, before: string, after: string) => void;
  onMergeUp: (id: string, trailing: string) => void;
}) {
  const { accent, textSubtle } = useThemeColors();
  // Seed the native field with the sentinel ahead of the label; React state and
  // saved data stay sentinel-free.
  const labelState = useNativeState(ENTRY_SENTINEL + entry.label);
  const fieldRef = useRef<TextFieldRef | null>(null);

  function handleTextChange(raw: string) {
    if (!raw.startsWith(ENTRY_SENTINEL)) {
      // The sentinel was backspaced away — the caret was at the very start.
      if (isFirst) {
        // Nothing above to merge into; put the sentinel back and stay put.
        fieldRef.current?.setText(ENTRY_SENTINEL + raw);
        fieldRef.current?.setSelection(ENTRY_SENTINEL.length, ENTRY_SENTINEL.length);
        return;
      }
      onMergeUp(entry.id, raw);
      return;
    }
    const body = raw.slice(ENTRY_SENTINEL.length);
    const nl = body.indexOf('\n');
    if (nl !== -1) {
      const before = body.slice(0, nl);
      const after = body.slice(nl + 1);
      // Drop the newline (and the moved tail) from this field straight away so
      // the row never visibly grows to two lines while the split commits.
      fieldRef.current?.setText(ENTRY_SENTINEL + before);
      onSplit(entry.id, before, after);
      return;
    }
    onRename(entry.id, body);
  }

  return (
    <HStack spacing={12}>
      <Image
        systemName={entry.checked ? 'checkmark.circle.fill' : 'circle'}
        color={entry.checked ? accent : textSubtle}
        size={20}
        modifiers={[
          contentTransition('interpolate'),
          animation(Animation.default, entry.checked ? 1 : 0),
          accessibilityLabel(entry.label || `Toggle entry ${position}`),
          onTapGesture(onToggle),
        ]}
      />
      <TextField
        ref={(r) => {
          fieldRef.current = r;
          registerRef(entry.id, r);
        }}
        text={labelState}
        placeholder="Checklist entry"
        axis="vertical"
        onTextChange={handleTextChange}
      />
    </HStack>
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
    // Tappable Text/Image instead of Buttons — see TimeRow for why (iOS 26
    // drops the row separator around button rows). The gesture also confines
    // the tap target to the label, like buttonStyle('borderless') did.
    <LabeledContent label="Location">
      <HStack spacing={8}>
        <Text
          modifiers={[
            foregroundStyle(accent),
            lineLimit(1),
            truncationMode('tail'),
            onTapGesture(onPick),
          ]}
        >
          {locationLabel(location)}
        </Text>
        {location ? (
          <Image
            systemName="xmark.circle.fill"
            color={textSubtle}
            size={20}
            modifiers={[accessibilityLabel('Clear location'), onTapGesture(onClear)]}
          />
        ) : null}
      </HStack>
    </LabeledContent>
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
  // Live handles to each row's native TextField, keyed by entry id, so split and
  // merge can move focus and place the caret imperatively. `pendingFocus` holds
  // the next such request; bumping `focusTick` runs the effect that applies it
  // once the (possibly freshly inserted) target row has registered its ref.
  const rowRefs = useRef(new Map<string, TextFieldRef>());
  const pendingFocus = useRef<{ id: string; cursor: number; setText?: string } | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const identity = itemIdentity(category);

  function registerRow(id: string, ref: TextFieldRef | null) {
    if (ref) rowRefs.current.set(id, ref);
    else rowRefs.current.delete(id);
  }

  function requestFocus(focus: ChecklistFocus, setText?: string) {
    pendingFocus.current = { ...focus, setText };
    setFocusTick((t) => t + 1);
  }

  useEffect(() => {
    const pf = pendingFocus.current;
    if (!pf) return;
    pendingFocus.current = null;
    const ref = rowRefs.current.get(pf.id);
    if (!ref) return;
    // A merged row needs its native text rewritten to the joined label (React
    // state alone won't push into a field that's already mounted).
    if (pf.setText !== undefined) ref.setText(pf.setText);
    ref.focus();
    // `cursor` is a label offset; the native field is shifted by the sentinel.
    const at = ENTRY_SENTINEL.length + pf.cursor;
    ref.setSelection(at, at);
  }, [focusTick]);

  function addEntry() {
    const id = newId();
    setChecklist((cl) => [...cl, { id, label: '', checked: false }]);
    requestFocus({ id, cursor: 0 });
  }

  function renameEntry(id: string, label: string) {
    setChecklist((cl) => cl.map((e) => (e.id === id ? { ...e, label } : e)));
  }

  function splitEntryAt(id: string, before: string, after: string) {
    const { checklist: next, focus } = splitEntry(checklist, id, before, after, newId);
    setChecklist(next);
    requestFocus(focus);
  }

  function mergeEntryAt(id: string, trailing: string) {
    const { checklist: next, focus } = mergeEntryUp(checklist, id, trailing);
    if (!focus) return;
    setChecklist(next);
    const merged = next.find((e) => e.id === focus.id);
    requestFocus(focus, ENTRY_SENTINEL + (merged?.label ?? ''));
  }

  const nameState = useNativeState(defaults.name);
  const notesState = useNativeState(defaults.notes);

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ItemFormValues, unknown, ItemFormValues>({
    resolver: zodResolver(itemFormSchema()),
    defaultValues: defaults,
    mode: 'onSubmit',
  });

  const notesText = useWatch({ control, name: 'notes' });
  const time = useWatch({ control, name: 'time' });

  const submit = handleSubmit(() => {
    const values = { ...getValues(), category };
    onSubmit(formToItem(values, itemId, initialItem, location, sanitizeChecklist(checklist)), date);
  });

  const heading = `${initialItem ? 'Edit' : 'New'} ${identity.label}`;

  function openLocationPicker() {
    // The picker opens blank every time (ADR-0012): it does not read the item's
    // current location, and cancelling leaves it untouched.
    beginLocationPick((loc) => setLocation(loc ?? null));
    router.push('/trip/location-picker');
  }

  return (
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      {/* Sheet title carries the category's accent + SF Symbol, so the picker icons
          below can stay monochrome (iOS strips per-item color through the Picker slot). */}
      <Stack.Title asChild>
        <View style={styles.titleRow}>
          <SymbolView
            name={identity.symbol as SymbolViewProps['name']}
            tintColor={identity.accent}
            resizeMode="scaleAspectFit"
            style={styles.titleIcon}
          />
          <RNText style={[styles.titleText, { color: identity.accent }]} numberOfLines={1}>
            {heading}
          </RNText>
        </View>
      </Stack.Title>
      {onCancel ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            accessibilityLabel="Cancel"
            icon="xmark"
            tintColor={c.accent}
            onPress={onCancel}
          />
        </Stack.Toolbar>
      ) : null}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          accessibilityLabel="Save"
          icon="checkmark"
          variant="prominent"
          tintColor={c.accent}
          onPress={submit}
        />
      </Stack.Toolbar>

      {/* tint() seeds the SwiftUI accent for everything in the Host — SwiftUI
          otherwise falls back to system blue. The Form swaps its system grouped
          background for the warm theme bg; Sections paint rows with the surface. */}
      <Host
        style={{ flex: 1 }}
        colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}
        modifiers={[tint(c.accent)]}
      >
        <Form modifiers={[scrollContentBackground('hidden'), background(c.background)]}>
          <Section
            footer={<FieldError message={errors.name?.message ?? errors.time?.message} />}
            modifiers={[listRowBackground(c.surface)]}
          >
            {tripOptions ? (
              <Picker
                label="Trip"
                selection={selectedTripId ?? ''}
                onSelectionChange={(v) => onSelectTrip?.(v as string)}
                modifiers={[pickerStyle('menu')]}
              >
                {tripOptions.map((option) => (
                  <Text
                    key={option.id}
                    modifiers={option.past ? [tag(option.id), foregroundStyle(c.textSubtle)] : [tag(option.id)]}
                  >
                    {option.past ? `${option.label} · Past` : option.label}
                  </Text>
                ))}
              </Picker>
            ) : null}

            <LabeledContent label={fieldLabel('Name', errors.name?.message, c.destructive)}>
              <TextField
                text={nameState}
                placeholder="What is it?"
                onTextChange={(t) => setValue('name', t)}
                modifiers={[multilineTextAlignment('trailing')]}
              />
            </LabeledContent>

            <Picker
              label="Category"
              selection={category}
              onSelectionChange={(v) => {
                const cat = v as ItemCategory;
                setCategory(cat);
                setValue('category', cat);
              }}
              modifiers={[pickerStyle('palette')]}
            >
              {ALL_CATEGORIES.map((cat) => (
                <Image
                  key={cat}
                  systemName={itemIdentity(cat).symbol}
                  size={20}
                  modifiers={[tag(cat), accessibilityLabel(itemIdentity(cat).label)]}
                />
              ))}
            </Picker>

            {trip && date ? (
              <DatePicker
                title="Date"
                selection={parseLocalDate(date)}
                displayedComponents={['date']}
                range={{
                  start: parseLocalDate(trip.startDate, 0),
                  end: parseLocalDate(trip.endDate, 23),
                }}
                onDateChange={(d) => setDate(localDateString(d))}
                modifiers={[datePickerStyle('compact')]}
              />
            ) : null}

            <LocationRow
              location={location}
              onPick={openLocationPicker}
              onClear={() => setLocation(null)}
            />

            <TimeRow
              value={time as string}
              onChange={(v) => setValue('time', v)}
              error={errors.time?.message}
            />

            <VStack alignment="leading" spacing={8}>
              <Text modifiers={[font({ size: 16 })]}>Notes</Text>
              <TextField
                text={notesState}
                placeholder="Anything else to remember"
                onTextChange={(t) => setValue('notes', t)}
                axis="vertical"
              />
              <NoteLinks text={notesText as string} />
            </VStack>
          </Section>

          <Section header={<Text>Checklist</Text>} modifiers={[listRowBackground(c.surface)]}>
            {/* List.ForEach gives the rows the system swipe-to-delete (onDelete)
                and long-press drag-to-reorder (onMove), matching the itinerary. */}
            <List.ForEach
              onDelete={(indices) =>
                setChecklist((cl) => cl.filter((_, i) => !indices.includes(i)))
              }
              onMove={(sourceIndices, destination) =>
                setChecklist((cl) => moveEntries(cl, sourceIndices, destination))
              }
            >
              {checklist.map((entry, i) => (
                <ChecklistEntryRow
                  key={entry.id}
                  entry={entry}
                  position={i + 1}
                  isFirst={i === 0}
                  registerRef={registerRow}
                  onRename={renameEntry}
                  onToggle={() =>
                    setChecklist((cl) =>
                      cl.map((e) => (e.id === entry.id ? { ...e, checked: !e.checked } : e)),
                    )
                  }
                  onSplit={splitEntryAt}
                  onMergeUp={mergeEntryAt}
                />
              ))}
            </List.ForEach>
            <Button label="Add entry" systemImage="plus" onPress={addEntry} />
          </Section>

          {initialItem && onDelete ? (
            <Section modifiers={[listRowBackground(c.surface)]}>
              <Button
                label="Delete"
                systemImage="trash"
                role="destructive"
                onPress={onDelete}
                modifiers={[foregroundStyle(c.destructive)]}
              />
            </Section>
          ) : null}
        </Form>
      </Host>
    </>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleIcon: { width: 18, height: 18 },
  titleText: { fontSize: 17, fontWeight: '600' },
});
