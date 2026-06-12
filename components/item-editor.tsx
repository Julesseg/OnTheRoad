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
  buttonStyle,
  frame,
  lineLimit,
  listRowBackground,
  scrollContentBackground,
  tint,
  truncationMode,
  onTapGesture,
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
import type { Item, ItemCategory } from '@/lib/schema';
import { beginLocationPick } from '@/lib/location-picker-session';

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
    // The compact picker makes the Form drop this row's bottom separator, so we
    // draw our own line just below it to keep the divider down to Notes.
    <VStack spacing={14}>
      <LabeledContent label={fieldLabel('Time', error, destructive)}>
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
            modifiers={[accessibilityLabel('Clear time'), foregroundStyle(textSubtle)]}
          />
        </HStack>
      </LabeledContent>
      <Divider modifiers={[frame({ height: 1 })]} />
    </VStack>
  );
}

function locationLabel(loc: Item['location'] | null): string {
  if (!loc) return 'Add location';
  if (loc.address) return loc.address;
  if (loc.lat != null && loc.lng != null) return `${loc.lat}, ${loc.lng}`;
  return 'Add location';
}

export function ItemEditor({ itemId, initialItem, defaultCategory, trip, initialDate, onSubmit, onDelete, onCancel }: ItemEditorProps) {
  const colorScheme = useColorScheme();
  const c = useThemeColors();
  const defaults = useMemo(
    () => (initialItem ? itemToForm(initialItem) : { ...emptyForm(), category: defaultCategory ?? 'activity' }),
    [initialItem, defaultCategory],
  );

  const [category, setCategory] = useState<ItemCategory>(defaults.category);
  const [date, setDate] = useState(initialDate ?? '');
  const [location, setLocation] = useState<Item['location'] | null>(initialItem?.location ?? null);
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
    onSubmit(formToItem(values, itemId, initialItem, location), date);
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
          <Stack.Toolbar.Button accessibilityLabel="Cancel" tintColor={c.accent} onPress={onCancel}>
            Cancel
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button accessibilityLabel="Save" variant="prominent" tintColor={c.accent} onPress={submit}>
          Save
        </Stack.Toolbar.Button>
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

            <LabeledContent label="Location">
              <HStack spacing={8}>
                <Button
                  label={locationLabel(location)}
                  onPress={openLocationPicker}
                  // Borderless confines the tap target to the label — the default
                  // style makes the whole Form row tappable.
                  modifiers={[buttonStyle('borderless'), lineLimit(1), truncationMode('tail')]}
                />
                {location ? (
                  <Button
                    label=""
                    systemImage="xmark.circle.fill"
                    onPress={() => setLocation(null)}
                    modifiers={[
                      accessibilityLabel('Clear location'),
                      foregroundStyle(c.textSubtle),
                      buttonStyle('borderless'),
                    ]}
                  />
                ) : null}
              </HStack>
            </LabeledContent>

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
