import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  type KeyboardTypeOptions,
} from 'react-native';
import { useForm, Controller, type Control, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  type ItemType,
  type ItemFormValues,
  emptyForm,
  itemToForm,
  formToItem,
  itemFormSchema,
} from '@/lib/item-form';
import type { Item } from '@/lib/schema';

export interface ItemEditorProps {
  type: ItemType;
  itemId: string;
  initialItem?: Item;
  onSubmit: (item: Item) => void;
  onDelete?: () => void;
  onCancel?: () => void;
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

function TextField(props: {
  control: Control<ItemFormValues>;
  name: keyof ItemFormValues;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
}) {
  const { control, name, label, placeholder, multiline, keyboardType, error } = props;
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <TextInput
            style={[styles.input, multiline && styles.multiline]}
            accessibilityLabel={label}
            placeholder={placeholder}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            multiline={multiline}
            keyboardType={keyboardType}
          />
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function TimeField(props: { label: string; value: string; onChange: (v: string) => void; error?: string }) {
  const { label, value, onChange, error } = props;
  const [show, setShow] = useState(false);
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.timeRow}>
        <Pressable accessibilityLabel={label} style={[styles.input, styles.timeButton]} onPress={() => setShow(true)}>
          <Text style={value ? styles.value : styles.placeholder}>{value || 'Not set'}</Text>
        </Pressable>
        {value ? (
          <Pressable accessibilityLabel={`Clear ${label}`} onPress={() => onChange('')}>
            <Text style={styles.clear}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {show ? (
        <View>
          <DateTimePicker
            mode="time"
            display="spinner"
            value={timeToDate(value)}
            onChange={(_e, d) => {
              if (d) onChange(dateToTime(d));
            }}
          />
          <Pressable onPress={() => setShow(false)}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function ControlledTime(props: {
  control: Control<ItemFormValues>;
  name: keyof ItemFormValues;
  label: string;
  error?: string;
}) {
  const { control, name, label, error } = props;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => <TimeField label={label} value={field.value} onChange={field.onChange} error={error} />}
    />
  );
}

export function ItemEditor({ type, itemId, initialItem, onSubmit, onDelete, onCancel }: ItemEditorProps) {
  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema(type)) as unknown as Resolver<ItemFormValues>,
    defaultValues: initialItem ? itemToForm(initialItem) : emptyForm(),
    mode: 'onSubmit',
  });

  const submit = handleSubmit(() => onSubmit(formToItem(type, getValues(), itemId)));

  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {onCancel ? (
          <Pressable accessibilityLabel="Cancel" onPress={onCancel}>
            <Text style={styles.barText}>Cancel</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable accessibilityLabel="Save" onPress={submit}>
          <Text style={[styles.barText, styles.save]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {type === 'note' ? (
          <TextField control={control} name="text" label="Note" placeholder="Anything to remember" multiline error={errors.text?.message} />
        ) : (
          <TextField control={control} name="name" label="Name" placeholder="What is it?" error={errors.name?.message} />
        )}

        {type === 'location' && (
          <>
            <TextField control={control} name="address" label="Address" />
            <TextField control={control} name="coords" label="Coordinates" placeholder="lat, lng" error={errors.coords?.message} />
            <ControlledTime control={control} name="time" label="Time" error={errors.time?.message} />
          </>
        )}

        {type === 'activity' && (
          <>
            <ControlledTime control={control} name="time" label="Time" error={errors.time?.message} />
            <TextField control={control} name="duration" label="Duration (min)" keyboardType="number-pad" error={errors.duration?.message} />
          </>
        )}

        {type === 'accommodation' && (
          <>
            <TextField control={control} name="address" label="Address" />
            <ControlledTime control={control} name="checkIn" label="Check-in" error={errors.checkIn?.message} />
            <ControlledTime control={control} name="checkOut" label="Check-out" error={errors.checkOut?.message} />
            <TextField control={control} name="confirmationNumber" label="Confirmation #" />
          </>
        )}

        {type !== 'note' && (
          <TextField control={control} name="notes" label="Notes" placeholder="Optional notes" multiline />
        )}

        {initialItem && onDelete ? (
          <Pressable accessibilityLabel="Delete item" style={styles.deleteButton} onPress={onDelete}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  barText: { fontSize: 17, color: '#007AFF' },
  save: { fontWeight: '600' },
  form: { padding: 20, paddingBottom: 40 },
  fieldGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeButton: { flex: 1 },
  value: { fontSize: 16, color: '#111' },
  placeholder: { fontSize: 16, color: '#999' },
  clear: { fontSize: 15, color: '#007AFF' },
  done: { fontSize: 16, color: '#007AFF', textAlign: 'right', paddingVertical: 8 },
  error: { marginTop: 6, fontSize: 13, color: '#d11' },
  deleteButton: { marginTop: 24, paddingVertical: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#fdeaea' },
  deleteText: { fontSize: 16, fontWeight: '600', color: '#d11' },
});
