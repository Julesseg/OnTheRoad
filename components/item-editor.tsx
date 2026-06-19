import React, { useCallback, useMemo, useRef, useState } from 'react';
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
  type TextFieldRef,
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
  submitLabel,
  onSubmit as onSubmitModifier,
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

// One committed checklist entry. Its own component so each row gets its own
// native text state; keyed by entry id, so the state follows the entry through
// reorders. The leading circle toggles `checked` (animating into a filled
// checkmark); everything commits on Save like the rest of the form. Removal is
// the system swipe-to-delete and reorder the system long-press drag — both
// wired on the surrounding List.ForEach, not here.
//
// New entries are typed in the persistent composer row below the list, not here
// (see ChecklistComposerRow). Pressing Return (labeled "next") on an existing
// entry jumps focus down to that composer so you can keep adding without
// reaching for it.
function ChecklistEntryRow({
  entry,
  position,
  onRename,
  onToggle,
  onSubmitEntry,
}: {
  entry: ChecklistItem;
  position: number;
  onRename: (label: string) => void;
  onToggle: () => void;
  onSubmitEntry: () => void;
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
      <TextField
        text={labelState}
        placeholder="Checklist entry"
        onTextChange={onRename}
        modifiers={[submitLabel('next'), onSubmitModifier(onSubmitEntry)]}
      />
    </HStack>
  );
}

// The persistent "add entry" field that sits at the bottom of the checklist.
// It is mounted once and never unmounts, which is the whole point: typing an
// entry and pressing Return commits it to the list above and clears this field
// *without ever moving focus to a freshly-mounted row*. Focus stays on this same
// native field the entire time, so the keyboard never bounces (the flicker came
// from mounting a new row and autofocusing it). `commit` runs on Return and on
// Save (for a draft typed but not yet submitted); `onChange` keeps the parent's
// pending-text ref in sync for the Save path.
function ChecklistComposerRow({
  fieldRef,
  textState,
  onChange,
  onSubmit,
}: {
  fieldRef: React.RefObject<TextFieldRef | null>;
  textState: ReturnType<typeof useNativeState<string>>;
  onChange: (label: string) => void;
  onSubmit: () => void;
}) {
  const { textSubtle } = useThemeColors();
  return (
    <HStack spacing={12}>
      <Image systemName="plus.circle" color={textSubtle} size={20} />
      <TextField
        ref={fieldRef}
        text={textState}
        placeholder="Add entry"
        onTextChange={onChange}
        modifiers={[submitLabel('next'), onSubmitModifier(onSubmit)]}
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
  const identity = itemIdentity(category);

  // The persistent composer: a single never-unmounting field for adding entries.
  // `composerRef` lets us keep focus on it after committing; `composerText` holds
  // the in-progress draft so it can be saved even if the user hits Save without
  // pressing Return first.
  const composerRef = useRef<TextFieldRef>(null);
  const composerState = useNativeState('');
  const composerText = useRef('');

  const commitComposer = useCallback(() => {
    const label = composerText.current.trim();
    // Clear the field and keep focus on it (same native view, no remount) so the
    // keyboard never moves — the committed entry mounts above us, unfocused.
    // setText clears the bound native state, so we don't touch composerState here.
    composerText.current = '';
    composerRef.current?.setText('');
    composerRef.current?.focus();
    if (label) setChecklist((cl) => [...cl, { id: newId(), label, checked: false }]);
  }, []);

  // Existing entries hand their Return down to the composer so adding can
  // continue from wherever the user was editing.
  const focusComposer = useCallback(() => composerRef.current?.focus(), []);

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

  // eslint-disable-next-line react-hooks/refs -- the composer draft ref is read on Save, not during render
  const submit = handleSubmit(() => {
    const values = { ...getValues(), category };
    // Fold in any draft sitting in the composer that was never submitted with
    // Return, so a half-typed entry isn't silently dropped on Save.
    const pending = composerText.current.trim();
    const full = pending
      ? [...checklist, { id: newId(), label: pending, checked: false }]
      : checklist;
    onSubmit(formToItem(values, itemId, initialItem, location, sanitizeChecklist(full)), date);
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
                  onRename={(label) =>
                    setChecklist((cl) => cl.map((e) => (e.id === entry.id ? { ...e, label } : e)))
                  }
                  onToggle={() =>
                    setChecklist((cl) =>
                      cl.map((e) => (e.id === entry.id ? { ...e, checked: !e.checked } : e)),
                    )
                  }
                  onSubmitEntry={focusComposer}
                />
              ))}
            </List.ForEach>
            {/* Persistent add field: stays mounted so committing an entry never
                moves focus to a freshly-mounted row (which bounced the keyboard). */}
            <ChecklistComposerRow
              fieldRef={composerRef}
              textState={composerState}
              onChange={(t) => {
                composerText.current = t;
              }}
              onSubmit={commitComposer}
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
