import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useTripStore } from '@/lib/store';
import { Trip, Day } from '@/lib/schema';

function buildDays(startDate: string, endDate: string): Day[] {
  const days: Day[] = [];
  const current = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);
    days.push({
      id: crypto.randomUUID(),
      date: dateStr,
      items: [],
    });
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(`${s}T00:00:00`).getTime());
}

export default function NewTripScreen() {
  const { addTrip } = useTripStore();
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert('Validation', 'Please enter a trip title.');
      return;
    }
    if (!isValidDate(startDate)) {
      Alert.alert('Validation', 'Start date must be YYYY-MM-DD.');
      return;
    }
    if (!isValidDate(endDate)) {
      Alert.alert('Validation', 'End date must be YYYY-MM-DD.');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('Validation', 'End date must be on or after start date.');
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const trip: Trip = {
        id: crypto.randomUUID(),
        schemaVersion: 1,
        title: title.trim(),
        startDate,
        endDate,
        isActive: true,
        days: buildDays(startDate, endDate),
        createdAt: now,
        updatedAt: now,
      };
      await addTrip(trip);
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to save trip. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} accessibilityLabel="Cancel">
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.heading}>New Trip</Text>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityLabel="Create trip"
            >
              <Text style={[styles.save, submitting && styles.disabled]}>Create</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Pacific Coast Highway"
              autoFocus
              returnKeyType="next"
            />

            <Text style={styles.label}>Start Date</Text>
            <TextInput
              style={styles.input}
              value={startDate}
              onChangeText={setStartDate}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              returnKeyType="next"
            />

            <Text style={styles.label}>End Date</Text>
            <TextInput
              style={styles.input}
              value={endDate}
              onChangeText={setEndDate}
              placeholder="YYYY-MM-DD"
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  heading: { fontSize: 17, fontWeight: '600' },
  cancel: { fontSize: 17, color: '#007AFF' },
  save: { fontSize: 17, color: '#007AFF', fontWeight: '600' },
  disabled: { opacity: 0.4 },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 20, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
});
