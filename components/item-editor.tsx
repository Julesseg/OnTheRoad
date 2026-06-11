import React, { useMemo, useState } from 'react';
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
  Divider,
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
  buttonStyle,
  frame,
  lineLimit,
  truncationMode,
  onTapGesture,
  padding,
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
import { itemIdentity, ITEM_IDENTITY } from '@/lib/item-identity';
import { extractLinks } from '@/lib/links';
import { localDateString } from '@/lib/today';
import type { ChecklistItem, Item, ItemCategory } from '@/lib/schema';
import { beginLocationPick } from '@/lib/location-picker-session';
import { moveEntries, sanitizeChecklist } from '@/lib/checklist';
import { newId } from '@/lib/id';

export interface ItemEditorProps {
  itemId: string;
  initialItem?: Item;
  defaultCategory?: ItemCategory;
  trip?: { startDate: string; endDate: string };
  initialDate?: string;
  onSubmit: (item: Item, date: string) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

const LABEL_GRAY = '#8A8580';
const ERROR_RED = '#d11';
const DELETE_RED = '#FF3B30';
const LINK_BLUE = '#007AFF';

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
function fieldLabel(label: string, error?: string): string | React.ReactNode {
  return error ? <Text modifiers={[foregroundStyle(ERROR_RED)]}>{label}</Text> : label;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text modifiers={[font({ size: 13 }), foregroundStyle(ERROR_RED)]}>{message}</Text>;
}

function NoteLinks({ text }: { text: string }) {
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
          <Image systemName="link" color={LINK_BLUE} size={13} />
          <Text modifiers={[font({ size: 14 }), foregroundStyle(LINK_BLUE)]}>{link.label}</Text>
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
  if (!value) {
    return (
      <LabeledContent label={fieldLabel('Time', error)}>
        <Button label="Add time" onPress={() => onChange('09:00')} />
      </LabeledContent>
    );
  }
  return (
    // The clear button makes iOS drop this row's bottom separator, and
    // listRowSeparator('visible') does not override that on iOS 26 — so we
    // draw our own. Negative bottom padding swallows the row's bottom inset
    // so the line sits where the native separator would.
    <VStack spacing={12} modifiers={[padding({ bottom: -11 })]}>
      <LabeledContent label={fieldLabel('Time', error)}>
        <HStack spacing={8}>
          <DatePicker
            title="Time"
            selection={timeToDate(value)}
            displayedComponents={['hourAndMinute']}
            onDateChange={(d) => onChange(dateToTime(d))}
            modifiers={[datePickerStyle('compact'), labelsHidden()]}
          />
          <Button
            label=""
            systemImage="xmark.circle.fill"
            onPress={() => onChange('')}
            modifiers={[accessibilityLabel('Clear time'), foregroundStyle(LABEL_GRAY)]}
          />
        </HStack>
      </LabeledContent>
      <Divider modifiers={[frame({ height: 1 })]} />
    </VStack>
  );
}

// One editable checklist entry. Its own component so each row gets its own
// native text state; keyed by entry id, so the state follows the entry through
// reorders. The leading circle toggles `checked` (animating into a filled
// checkmark); everything commits on Save like the rest of the form. Removal is
// the system swipe-to-delete and reorder the system long-press drag — both
// wired on the surrounding List.ForEach, not here.
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
  const labelState = useNativeState(entry.label);
  return (
    <HStack spacing={12}>
      <Image
        systemName={entry.checked ? 'checkmark.circle.fill' : 'circle'}
        color={entry.checked ? LINK_BLUE : LABEL_GRAY}
        size={20}
        modifiers={[
          contentTransition('interpolate'),
          animation(Animation.default, entry.checked ? 1 : 0),
          accessibilityLabel(`Toggle entry ${position}`),
          onTapGesture(onToggle),
        ]}
      />
      <TextField text={labelState} placeholder="Checklist entry" onTextChange={onRename} />
    </HStack>
  );
}

function locationLabel(loc: Item['location'] | null): string {
  if (!loc) return 'Add location';
  if (loc.address) return loc.address;
  if (loc.lat != null && loc.lng != null) return `${loc.lat}, ${loc.lng}`;
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
  const row = (
    <LabeledContent label="Location">
      <HStack spacing={8}>
        <Button
          label={locationLabel(location)}
          onPress={onPick}
          // Borderless confines the tap target to the label — the default
          // style makes the whole Form row tappable.
          modifiers={[buttonStyle('borderless'), lineLimit(1), truncationMode('tail')]}
        />
        {location ? (
          <Button
            label=""
            systemImage="xmark.circle.fill"
            onPress={onClear}
            modifiers={[
              accessibilityLabel('Clear location'),
              foregroundStyle(LABEL_GRAY),
              buttonStyle('borderless'),
            ]}
          />
        ) : null}
      </HStack>
    </LabeledContent>
  );
  if (!location) return row;
  return (
    // Same separator workaround as TimeRow, triggered once a location is set.
    <VStack spacing={12} modifiers={[padding({ bottom: -11 })]}>
      {row}
      <Divider modifiers={[frame({ height: 1 })]} />
    </VStack>
  );
}

export function ItemEditor({ itemId, initialItem, defaultCategory, trip, initialDate, onSubmit, onDelete, onCancel }: ItemEditorProps) {
  const colorScheme = useColorScheme();
  const defaults = useMemo(
    () => (initialItem ? itemToForm(initialItem) : { ...emptyForm(), category: defaultCategory ?? 'activity' }),
    [initialItem, defaultCategory],
  );

  const [category, setCategory] = useState<ItemCategory>(defaults.category);
  const [date, setDate] = useState(initialDate ?? '');
  const [location, setLocation] = useState<Item['location'] | null>(initialItem?.location ?? null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initialItem?.checklist ?? []);
  const identity = itemIdentity(category);

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
    beginLocationPick({
      initialLocation: location ?? undefined,
      onConfirm: (loc) => setLocation(loc ?? null),
    });
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
          <Stack.Toolbar.Button accessibilityLabel="Cancel" onPress={onCancel}>
            Cancel
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button accessibilityLabel="Save" variant="prominent" onPress={submit}>
          Save
        </Stack.Toolbar.Button>
      </Stack.Toolbar>

      <Host style={{ flex: 1 }} colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}>
        <Form>
          <Section
            footer={<FieldError message={errors.name?.message ?? errors.time?.message} />}
          >
            <LabeledContent label={fieldLabel('Name', errors.name?.message)}>
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

          <Section header={<Text>Checklist</Text>}>
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
            <Button
              label="Add entry"
              systemImage="plus"
              onPress={() =>
                setChecklist((cl) => [...cl, { id: newId(), label: '', checked: false }])
              }
            />
          </Section>

          {initialItem && onDelete ? (
            <Section>
              <Button
                label="Delete"
                systemImage="trash"
                role="destructive"
                onPress={onDelete}
                modifiers={[foregroundStyle(DELETE_RED)]}
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
