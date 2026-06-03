import React, { useMemo, useRef, useState } from 'react';
import { Modal, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
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
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  datePickerStyle,
  pickerStyle,
  tag,
} from '@expo/ui/swift-ui/modifiers';

import {
  type ItemType,
  type ItemFormValues,
  emptyForm,
  itemToForm,
  formToItem,
  itemFormSchema,
  parseCoords,
  durationToHm,
  hmToDuration,
} from '@/lib/item-form';
import { itemIdentity, type ItemIdentity } from '@/lib/item-identity';
import { CoordsPicker } from '@/components/coords-picker';
import type { Item } from '@/lib/schema';

export interface ItemEditorProps {
  type: ItemType;
  itemId: string;
  initialItem?: Item;
  onSubmit: (item: Item) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}

const LABEL_GRAY = '#8A8580';
const ERROR_RED = '#d11';

// Wheel options. Hours cover a full day so any stored duration round-trips; minutes
// step by 5 per the brief. A legacy value off the 5-minute grid (e.g. 7) is preserved
// in the form until the traveller actually turns the wheel — see durationToHm.
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);
const MINUTE_OPTIONS = Array.from({ length: 12 }, (_, i) => i * 5);

function timeToDate(t: string): Date {
  const d = new Date();
  const m = t.match(/^(\d{2}):(\d{2})$/);
  if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d;
}

function dateToTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Warm, rounded-font section header carrying the type's symbol + accent (ADR-0003). */
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

/** A labeled form row; the label tints red when its field is in error. */
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

/** A native compact time picker that keeps an "unset" state in the surrounding row:
 *  a placeholder Button when unset, the picker + an inline Clear once a time is set. */
function TimeRow({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  if (!value) {
    return (
      <FieldRow label={label} error={error}>
        <Button label={`Add ${label.toLowerCase()}`} onPress={() => onChange('09:00')} />
      </FieldRow>
    );
  }
  return (
    <FieldRow label={label} error={error}>
      <HStack spacing={12}>
        <DatePicker
          title={label}
          selection={timeToDate(value)}
          displayedComponents={['hourAndMinute']}
          onDateChange={(d) => onChange(dateToTime(d))}
          modifiers={[datePickerStyle('compact')]}
        />
        <Button label={`Clear ${label.toLowerCase()}`} onPress={() => onChange('')} />
      </HStack>
    </FieldRow>
  );
}

/** Hours + minutes wheel for an Activity's duration, stored as total whole minutes.
 *  Optional like the time rows: a placeholder Button when unset, wheels + Clear once set. */
function DurationRow({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const hm = durationToHm(value);
  if (!hm) {
    return (
      <FieldRow label="Duration" error={error}>
        <Button label="Add a duration" onPress={() => onChange(hmToDuration(1, 0))} />
      </FieldRow>
    );
  }
  return (
    <FieldRow label="Duration" error={error}>
      <HStack spacing={0}>
        <Picker
          label="Hours"
          selection={hm.hours}
          onSelectionChange={(h) => onChange(hmToDuration(h as number, hm.minutes))}
          modifiers={[pickerStyle('wheel')]}
        >
          {HOUR_OPTIONS.map((h) => (
            <Text key={h} modifiers={[tag(h)]}>{`${h} h`}</Text>
          ))}
        </Picker>
        <Picker
          label="Minutes"
          selection={hm.minutes}
          onSelectionChange={(m) => onChange(hmToDuration(hm.hours, m as number))}
          modifiers={[pickerStyle('wheel')]}
        >
          {MINUTE_OPTIONS.map((m) => (
            <Text key={m} modifiers={[tag(m)]}>{`${m} m`}</Text>
          ))}
        </Picker>
        <Button label="Clear duration" onPress={() => onChange('')} />
      </HStack>
    </FieldRow>
  );
}

export function ItemEditor({ type, itemId, initialItem, onSubmit, onDelete, onCancel }: ItemEditorProps) {
  const colorScheme = useColorScheme();
  const identity = itemIdentity(type);
  const defaults = useMemo(
    () => (initialItem ? itemToForm(initialItem) : emptyForm()),
    [initialItem],
  );

  // Native two-way binding seeds each text field's initial text (edit path); the
  // mirror into react-hook-form below keeps validation in sync.
  const nameState = useNativeState(defaults.name);
  const textState = useNativeState(defaults.text);
  const addressState = useNativeState(defaults.address);
  const confirmationState = useNativeState(defaults.confirmationNumber);
  const notesState = useNativeState(defaults.notes);

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ItemFormValues, unknown, ItemFormValues>({
    resolver: zodResolver(itemFormSchema(type)),
    defaultValues: defaults,
    mode: 'onSubmit',
  });

  const addressRef = useRef<TextFieldRef>(null);
  const [coordsOpen, setCoordsOpen] = useState(false);

  const coords = useWatch({ control, name: 'coords' });
  const time = useWatch({ control, name: 'time' });
  const checkIn = useWatch({ control, name: 'checkIn' });
  const checkOut = useWatch({ control, name: 'checkOut' });
  const duration = useWatch({ control, name: 'duration' });

  const submit = handleSubmit(() => onSubmit(formToItem(type, getValues(), itemId, initialItem)));

  function suggestAddress(address: string) {
    if (!getValues('address')) {
      setValue('address', address, { shouldDirty: true });
      // Reflect the autofill in the native field too (RHF holds the saved value).
      void addressRef.current?.setText(address);
    }
  }

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
            footer={<FieldError message={firstError(type, errors)} />}
          >
            {type === 'note' ? (
              <FieldRow label="Note" error={errors.text?.message}>
                <TextField
                  text={textState}
                  placeholder="Anything to remember"
                  onTextChange={(t) => setValue('text', t)}
                />
              </FieldRow>
            ) : (
              <FieldRow label="Name" error={errors.name?.message}>
                <TextField
                  text={nameState}
                  placeholder="What is it?"
                  onTextChange={(t) => setValue('name', t)}
                />
              </FieldRow>
            )}

            {type === 'location' && (
              <>
                <FieldRow label="Address">
                  <TextField
                    ref={addressRef}
                    text={addressState}
                    placeholder="Street, city, or landmark"
                    onTextChange={(t) => setValue('address', t)}
                  />
                </FieldRow>
                <FieldRow label="Coordinates" error={errors.coords?.message}>
                  <HStack spacing={12}>
                    <Button
                      label={coords || 'Set on map'}
                      systemImage="map"
                      onPress={() => setCoordsOpen(true)}
                    />
                    {coords ? (
                      <Button label="Clear coordinates" onPress={() => setValue('coords', '')} />
                    ) : null}
                  </HStack>
                </FieldRow>
                <TimeRow
                  label="Time"
                  value={time}
                  onChange={(v) => setValue('time', v)}
                  error={errors.time?.message}
                />
              </>
            )}

            {type === 'activity' && (
              <>
                <TimeRow
                  label="Time"
                  value={time}
                  onChange={(v) => setValue('time', v)}
                  error={errors.time?.message}
                />
                <DurationRow
                  value={duration}
                  onChange={(v) => setValue('duration', v)}
                  error={errors.duration?.message}
                />
              </>
            )}

            {type === 'accommodation' && (
              <>
                <FieldRow label="Address">
                  <TextField
                    ref={addressRef}
                    text={addressState}
                    placeholder="Street, city, or landmark"
                    onTextChange={(t) => setValue('address', t)}
                  />
                </FieldRow>
                <TimeRow
                  label="Check-in"
                  value={checkIn}
                  onChange={(v) => setValue('checkIn', v)}
                  error={errors.checkIn?.message}
                />
                <TimeRow
                  label="Check-out"
                  value={checkOut}
                  onChange={(v) => setValue('checkOut', v)}
                  error={errors.checkOut?.message}
                />
                <FieldRow label="Confirmation #">
                  <TextField
                    text={confirmationState}
                    placeholder="Booking code"
                    onTextChange={(t) => setValue('confirmationNumber', t)}
                    modifiers={[font({ design: 'monospaced' })]}
                  />
                </FieldRow>
              </>
            )}

            {type !== 'note' && (
              <FieldRow label="Notes">
                <TextField
                  text={notesState}
                  placeholder="Anything else to remember"
                  onTextChange={(t) => setValue('notes', t)}
                />
              </FieldRow>
            )}
          </Section>

          {initialItem && onDelete ? (
            <Section>
              <Button label="Delete" systemImage="trash" role="destructive" onPress={onDelete} />
            </Section>
          ) : null}
        </Form>
      </Host>

      <Modal
        visible={coordsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCoordsOpen(false)}
      >
        {coordsOpen ? (
          <CoordsPicker
            initial={parseCoords(coords)}
            onCancel={() => setCoordsOpen(false)}
            onConfirm={(c, extras) => {
              setValue('coords', `${c.lat}, ${c.lng}`);
              if (extras?.address) suggestAddress(extras.address);
              setCoordsOpen(false);
            }}
          />
        ) : null}
      </Modal>
    </>
  );
}

/** The first field error to surface in a type's Section footer (one message at a time). */
function firstError(
  type: ItemType,
  errors: Partial<Record<keyof ItemFormValues, { message?: string }>>,
): string | undefined {
  const order: (keyof ItemFormValues)[] =
    type === 'note'
      ? ['text']
      : type === 'location'
        ? ['name', 'coords', 'time']
        : type === 'activity'
          ? ['name', 'time', 'duration']
          : ['name', 'checkIn', 'checkOut'];
  for (const f of order) {
    const m = errors[f]?.message;
    if (m) return m;
  }
  return undefined;
}
