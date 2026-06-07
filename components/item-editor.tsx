import React, { useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
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
  frame,
  onTapGesture,
} from '@expo/ui/swift-ui/modifiers';

import {
  type ItemFormValues,
  emptyForm,
  itemToForm,
  formToItem,
  itemFormSchema,
} from '@/lib/item-form';
import { itemIdentity, ITEM_IDENTITY, type ItemIdentity } from '@/lib/item-identity';
import { extractLinks } from '@/lib/links';
import type { Item, ItemCategory } from '@/lib/schema';

export interface ItemEditorProps {
  itemId: string;
  initialItem?: Item;
  defaultCategory?: ItemCategory;
  onSubmit: (item: Item) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

const LABEL_GRAY = '#8A8580';
const ERROR_RED = '#d11';
const DELETE_RED = '#FF3B30';
const LINK_BLUE = '#007AFF';

const ALL_CATEGORIES = Object.keys(ITEM_IDENTITY) as ItemCategory[];

function timeToDate(t: string): Date {
  const d = new Date();
  const m = t.match(/^(\d{2}):(\d{2})$/);
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function dateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Section header showing the currently selected category's symbol + accent. */
function IdentityHeader({ identity }: { identity: ItemIdentity }) {
  return (
    <HStack spacing={6}>
      <Image systemName={identity.symbol} color={identity.accent} size={15} />
      <Text
        modifiers={[font({ design: 'rounded', weight: 'semibold', size: 15 }), foregroundStyle(identity.accent)]}
      >
        {identity.label}
      </Text>
    </HStack>
  );
}

function FieldRow({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <VStack alignment="leading" spacing={3}>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(error ? ERROR_RED : LABEL_GRAY)]}>{label}</Text>
      {children}
    </VStack>
  );
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
              void import('react-native').then(({ Linking }) => Linking.openURL(link.url).catch(() => {}));
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
      <FieldRow label="Time" error={error}>
        <HStack modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}>
          <Button label="Add time" onPress={() => onChange('09:00')} />
        </HStack>
      </FieldRow>
    );
  }
  return (
    <FieldRow label="Time" error={error}>
      <HStack spacing={12} modifiers={[frame({ maxWidth: Infinity, alignment: 'center' })]}>
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
    </FieldRow>
  );
}

export function ItemEditor({ itemId, initialItem, defaultCategory, onSubmit, onDelete, onCancel }: ItemEditorProps) {
  const colorScheme = useColorScheme();
  const defaults = useMemo(
    () => (initialItem ? itemToForm(initialItem) : { ...emptyForm(), category: defaultCategory ?? 'activity' }),
    [initialItem, defaultCategory],
  );

  const [category, setCategory] = useState<ItemCategory>(defaults.category);
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
    onSubmit(formToItem(values, itemId, initialItem));
  });

  const heading = `${initialItem ? 'Edit' : 'New'} ${identity.label}`;

  return (
    <>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>{heading}</Stack.Title>
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
            header={<IdentityHeader identity={identity} />}
            footer={<FieldError message={errors.name?.message ?? errors.time?.message} />}
          >
            <FieldRow label="Name" error={errors.name?.message}>
              <TextField
                text={nameState}
                placeholder="What is it?"
                onTextChange={(t) => setValue('name', t)}
              />
            </FieldRow>

            <FieldRow label="Category">
              <Picker
                label="Category"
                selection={category}
                onSelectionChange={(v) => {
                  const cat = v as ItemCategory;
                  setCategory(cat);
                  setValue('category', cat);
                }}
                modifiers={[pickerStyle('segmented')]}
              >
                {ALL_CATEGORIES.map((cat) => (
                  <Text key={cat} modifiers={[tag(cat)]}>
                    {itemIdentity(cat).label}
                  </Text>
                ))}
              </Picker>
            </FieldRow>

            <TimeRow
              value={time as string}
              onChange={(v) => setValue('time', v)}
              error={errors.time?.message}
            />

            <FieldRow label="Notes">
              <TextField
                text={notesState}
                placeholder="Anything else to remember"
                onTextChange={(t) => setValue('notes', t)}
                axis="vertical"
              />
              <NoteLinks text={notesText as string} />
            </FieldRow>
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
