import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, Text as RNText, View, useColorScheme } from 'react-native';
import { Stack, router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import {
  Host,
  Form,
  Section,
  Text,
  TextField,
  type TextFieldRef,
  DatePicker,
  Picker,
  Button,
  Image,
  HStack,
  VStack,
  Spacer,
  Toggle,
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
  labelsHidden,
  background,
  frame,
  lineLimit,
  listRowBackground,
  scrollContentBackground,
  tint,
  truncationMode,
  onTapGesture,
  contentShape,
  shapes,
  fixedSize,
  clipped,
  contentTransition,
  animation,
  Animation,
} from '@expo/ui/swift-ui/modifiers';

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

// The collapsed Time row shows the value the way the locale would write it
// (e.g. "9:00 AM" or "09:00") under the "Time" label.
function formatTime(t: string): string {
  return timeToDate(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
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

// The natural height of a wheel hour/minute picker. While the toggle is on the
// picker stays mounted at this full height; collapsing/expanding animates a
// clipped window over it from 0 → full, anchored to the top edge, so the picker
// is revealed downward from under the row (and slides the Location row below)
// rather than popping in and out.
const TIME_PICKER_HEIGHT = 216;

// The Time row carries the optional/"unset" state in its trailing Toggle:
//   off            → no time, no picker, no subtitle
//   switching on   → defaults to 09:00 and expands an inline time picker
//   tapping body   → collapses the picker to a locale-formatted value subtitle
//                    under the "Time" label (tap again re-expands)
//   switching off  → clears the time
// Opening an existing timed item starts on, collapsed, showing the value.
//
// Reveal is animated: one eased transaction grows/shrinks the picker's clipped
// window and slides the "Time" label and value subtitle into place together.
function TimeRow({
  value,
  expanded,
  onToggle,
  onToggleExpand,
  onChange,
}: {
  value: string;
  expanded: boolean;
  onToggle: (on: boolean) => void;
  onToggleExpand: () => void;
  onChange: (v: string) => void;
}) {
  const { textSubtle } = useThemeColors();
  const on = value !== '';
  const open = on && expanded;
  // A single value that changes on every visual phase (off / on-collapsed /
  // on-expanded), so the `animation` modifier eases the label reposition and the
  // picker's reveal together in one transaction.
  const phase = (on ? 1 : 0) + (expanded ? 2 : 0);
  return (
    <VStack
      alignment="leading"
      spacing={0}
      modifiers={[animation(Animation.easeInOut({ duration: 0.25 }), phase)]}
    >
      {/* The whole row (icon + label, but not the trailing Toggle, which consumes
          its own taps) collapses/expands the picker. contentShape makes the empty
          space hit-test, so a tap anywhere on the row body registers. */}
      <HStack
        spacing={12}
        modifiers={on ? [contentShape(shapes.rectangle()), onTapGesture(onToggleExpand)] : []}
      >
        <Image systemName="clock" color={textSubtle} size={20} />
        <VStack alignment="leading" spacing={2} modifiers={[frame({ maxWidth: Infinity, alignment: 'leading' })]}>
          <Text>Time</Text>
          {on && !expanded ? (
            <Text modifiers={[font({ size: 13 }), foregroundStyle(textSubtle)]}>{formatTime(value)}</Text>
          ) : null}
        </VStack>
        <Toggle
          isOn={on}
          onIsOnChange={onToggle}
          modifiers={[labelsHidden(), accessibilityLabel('Time')]}
        />
      </HStack>
      {/* Kept mounted while the toggle is on. fixedSize holds the wheel at its
          natural height; the clipped frame (0 when collapsed, full when expanded,
          anchored top) is the only thing that animates — so the picker slides out
          from under the row instead of the wheel itself squashing. */}
      {on ? (
        <DatePicker
          title="Time"
          selection={timeToDate(value)}
          displayedComponents={['hourAndMinute']}
          onDateChange={(d) => onChange(dateToTime(d))}
          modifiers={[
            datePickerStyle('wheel'),
            labelsHidden(),
            fixedSize({ vertical: true }),
            frame({ height: open ? TIME_PICKER_HEIGHT : 0, alignment: 'top' }),
            clipped(),
          ]}
        />
      ) : null}
    </VStack>
  );
}

// One committed checklist entry. Its own component so each row gets its own
// native text state; keyed by entry id, so the state follows the entry through
// reorders. The leading circle toggles `checked` (animating into a filled
// checkmark); everything commits on Save like the rest of the form. Removal is
// the system swipe-to-delete and reorder the system long-press drag — both
// wired on the surrounding List.ForEach, not here.
//
// New entries are typed in the persistent composer row below the list, not here
// (see ChecklistComposerRow); this row only renames an existing entry.
function ChecklistEntryRow({
  entry,
  position,
  onRename,
  onToggle,
}: {
  entry: ChecklistItem;
  position: number;
  onRename: (label: string) => void;
  onToggle: () => void;
}) {
  const { accent, textSubtle } = useThemeColors();
  const labelState = useNativeState(entry.label);
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
      <TextField text={labelState} placeholder="Checklist entry" onTextChange={onRename} />
    </HStack>
  );
}

// The persistent "add entry" field at the bottom of the checklist. It mounts
// once and never unmounts, and — crucially — it is a multiline field with NO
// submit handler. SwiftUI's `.onSubmit` resigns the field's first responder the
// instant Return is pressed (natively, before any JS runs), which is what bounced
// the keyboard: re-focusing afterwards over the JS bridge always lands a frame
// too late. A multiline field instead inserts a newline on Return and keeps the
// keyboard up. We watch the text for that newline in `onChange`, commit the line
// as an entry, and strip it — focus never leaves this field, so the keyboard
// cannot move. (Pasting multiple lines commits each, which is a nice bonus.)
function ChecklistComposerRow({
  fieldRef,
  textState,
  onChange,
}: {
  fieldRef: React.RefObject<TextFieldRef | null>;
  textState: ReturnType<typeof useNativeState<string>>;
  onChange: (label: string) => void;
}) {
  const { textSubtle } = useThemeColors();
  return (
    <HStack spacing={12}>
      <Image systemName="plus.circle" color={textSubtle} size={20} />
      <TextField
        ref={fieldRef}
        text={textState}
        placeholder="Add entry"
        axis="vertical"
        onTextChange={onChange}
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
    // Tappable Text/Image instead of Buttons — iOS 26 drops the row's bottom
    // separator around button rows, and the gesture also confines the tap target
    // to the label. The leading `map` glyph matches the itinerary's location icon;
    // the value/CTA is trailing-aligned (Spacer pushes it to the right).
    <HStack spacing={12}>
      <Image systemName="map" color={textSubtle} size={20} />
      <Spacer />
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
  // empty), and Notes drives the live link extraction below the field. The
  // native field text is bound through useNativeState so the field can be seeded
  // and edited natively; onTextChange mirrors it into React state.
  const nameState = useNativeState(defaults.name);
  const notesState = useNativeState(defaults.notes);
  const [name, setName] = useState(defaults.name);
  const [notes, setNotes] = useState(defaults.notes);

  // Time lives in plain state: '' means unset (toggle off). `timeExpanded` tracks
  // whether the inline picker is shown vs. collapsed to a value subtitle.
  const [time, setTime] = useState(defaults.time);
  const [timeExpanded, setTimeExpanded] = useState(false);

  // The persistent composer: a single never-unmounting multiline field for
  // adding entries. `composerText` mirrors its draft so a half-typed entry can
  // still be saved without pressing Return first.
  const composerRef = useRef<TextFieldRef>(null);
  const composerState = useNativeState('');
  const composerText = useRef('');

  // Return inserts a newline in the multiline composer (rather than dismissing
  // the keyboard). Each completed line becomes an entry; the trailing fragment
  // stays as the live draft, with the newline stripped from the field so focus
  // never leaves it.
  const onComposerChange = useCallback((text: string) => {
    if (!text.includes('\n')) {
      composerText.current = text;
      return;
    }
    const parts = text.split('\n');
    const draft = parts.pop() ?? '';
    const added = parts
      .map((s) => s.trim())
      .filter(Boolean)
      .map((label) => ({ id: newId(), label, checked: false }));
    composerText.current = draft;
    composerRef.current?.setText(draft);
    if (added.length) setChecklist((cl) => [...cl, ...added]);
  }, []);

  const canSave = name.trim().length > 0;

  // The composer draft ref is read here on Save, not during render.
  function submit() {
    const values: ItemFormValues = { name, category, time, notes };
    // Fold in any draft sitting in the composer that was never submitted with
    // Return, so a half-typed entry isn't silently dropped on Save.
    const pending = composerText.current.trim();
    const full = pending
      ? [...checklist, { id: newId(), label: pending, checked: false }]
      : checklist;
    onSubmit(formToItem(values, itemId, initialItem, location, sanitizeChecklist(full)), date);
  }

  const heading = `${initialItem ? 'Edit' : 'New'} ${identity.label}`;

  function openLocationPicker() {
    // The picker opens blank every time (ADR-0012): it does not read the item's
    // current location, and cancelling leaves it untouched.
    beginLocationPick((loc) => setLocation(loc ?? null));
    router.push('/trip/location-picker');
  }

  function onTimeToggle(on: boolean) {
    if (on) {
      setTime('09:00');
      setTimeExpanded(true);
    } else {
      setTime('');
      setTimeExpanded(false);
    }
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
        {/* Name-required validation is enforced here: the Save button is disabled
            while Name is empty, so there is no section-footer error. */}
        <Stack.Toolbar.Button
          accessibilityLabel="Save"
          icon="checkmark"
          variant="prominent"
          tintColor={c.accent}
          disabled={!canSave}
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
          {/* Share editor only: the destination Trip picker is its own section at
              the very top, above the title/notes cell. */}
          {tripOptions ? (
            <Section modifiers={[listRowBackground(c.surface)]}>
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
            </Section>
          ) : null}

          {/* Combined title/notes cell: Name (larger, semibold) over Notes, both
              leading-aligned with no labels; extracted note links render here too. */}
          <Section modifiers={[listRowBackground(c.surface)]}>
            <VStack alignment="leading" spacing={8}>
              <TextField
                text={nameState}
                placeholder="Title"
                onTextChange={setName}
                modifiers={[font({ size: 24, weight: 'semibold' })]}
              />
              <TextField
                text={notesState}
                placeholder="Notes"
                onTextChange={setNotes}
                axis="vertical"
              />
              <NoteLinks text={notes} />
            </VStack>
          </Section>

          {/* Icon-led detail rows. Category is a segmented picker with no leading
              icon; Date / Time / Location each carry a monochrome leading glyph. */}
          <Section modifiers={[listRowBackground(c.surface)]}>
            <Picker
              label="Category"
              selection={category}
              onSelectionChange={(v) => setCategory(v as ItemCategory)}
              modifiers={[pickerStyle('segmented')]}
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
              <HStack spacing={12}>
                <Image systemName="calendar" color={c.textSubtle} size={20} />
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
              </HStack>
            ) : null}

            <TimeRow
              value={time}
              expanded={timeExpanded}
              onToggle={onTimeToggle}
              onToggleExpand={() => setTimeExpanded((e) => !e)}
              onChange={setTime}
            />

            <LocationRow
              location={location}
              onPick={openLocationPicker}
              onClear={() => setLocation(null)}
            />
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
                  onRename={(label) =>
                    setChecklist((cl) => cl.map((e) => (e.id === entry.id ? { ...e, label } : e)))
                  }
                  onToggle={() =>
                    setChecklist((cl) =>
                      cl.map((e) => (e.id === entry.id ? { ...e, checked: !e.checked } : e)),
                    )
                  }
                />
              ))}
            </List.ForEach>
            {/* Persistent add field: stays mounted and never submits, so adding
                an entry never moves focus and the keyboard cannot flicker. */}
            <ChecklistComposerRow
              fieldRef={composerRef}
              textState={composerState}
              onChange={onComposerChange}
            />
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
