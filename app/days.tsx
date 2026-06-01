import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, useColorScheme } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Stack, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { VStack, HStack, Text as SwiftText } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  padding,
  glassEffect,
  clipShape,
  useScrollGeometryChange,
} from '@expo/ui/swift-ui/modifiers';

import { useTripStore } from '@/lib/store';
import { ItineraryPanel } from '@/components/itinerary-panel';
import { tripHeaderModel } from '@/lib/trip-header';
import {
  tripCountdownBadge,
  countdownPillLabel,
  compactCountdownPillLabel,
} from '@/lib/trip-badge';
import { todayString, formatDateRange } from '@/lib/date-utils';
import { exportTripAsFile } from '@/lib/storage';

const TINT = '#007AFF';
const WHITE = '#ffffff';

export default function DaysSheet() {
  const {
    trips,
    loadedTrips,
    displayedTripId,
    activeTripId,
    initialized,
    loadTripById,
    setFavorite,
    resetDisplayedTrip,
    removeTrip,
  } = useTripStore();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const text = isDark ? '#fff' : '#111';
  const subtext = isDark ? '#9a9a9a' : '#888';

  const today = todayString();
  const model = tripHeaderModel(displayedTripId, trips, activeTripId, today);
  const tripId = model.mode === 'empty' ? null : model.tripId;
  const summary = tripId ? (trips.find((t) => t.id === tripId) ?? null) : null;
  const trip = summary ? (loadedTrips[summary.id] ?? null) : null;

  useEffect(() => {
    if (summary) loadTripById(summary.id);
  }, [summary?.id]);

  // The large title scrolls away as the List's first row; `collapsed` ramps 0→1
  // as it passes under the bar, cross-fading in the compact inline title
  // (ADR-0002). Driven on the UI thread by SwiftUI's scroll geometry.
  const collapsed = useSharedValue(0);
  const scrollModifier = useScrollGeometryChange((geometry) => {
    'worklet';
    const start = 8;
    const band = 56;
    const progress = (geometry.contentOffsetY - start) / band;
    collapsed.value = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  });
  const inlineTitleStyle = useAnimatedStyle(() => ({ opacity: collapsed.value }));

  async function onExport() {
    if (!summary) return;
    try {
      const uri = await exportTripAsFile(summary.id);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/json',
          UTI: 'public.json',
          dialogTitle: `Export ${summary.title}`,
        });
      } else {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      }
    } catch {
      Alert.alert('Export failed', 'Could not export this trip.');
    }
  }

  function onDelete() {
    if (!summary) return;
    Alert.alert('Delete trip', `Delete "${summary.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeTrip(summary.id) },
    ]);
  }

  if (!initialized) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Empty state: a single Trips button (the gateway to Settings / Archived /
  // Import) and a non-collapsing "On the Road" title — no star, back, or overflow.
  if (model.mode === 'empty' || !summary) {
    return (
      <View style={styles.empty}>
        <Stack.Header blurEffect="systemMaterial" />
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon="list.bullet"
            accessibilityLabel="Trips"
            onPress={() => router.push('/trips')}
          />
        </Stack.Toolbar>
        <Text style={[styles.emptyTitle, { color: text }]}>On the Road</Text>
        <Text style={[styles.emptyHint, { color: subtext }]}>
          Tap Trips to create or import a trip.
        </Text>
      </View>
    );
  }

  const badge = tripCountdownBadge(summary, today);
  const dateRange = formatDateRange(summary.startDate, summary.endDate);

  // The native navigation row: a leading back-arrow while browsing a non-default
  // Trip, and a trailing group of the star (own glass capsule), Trips, and a `⋯`
  // overflow Menu (Export / Delete) that share one glass background.
  const chrome = (
    <>
      <Stack.Header blurEffect="systemMaterial" />
      {model.showBackArrow ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button
            icon="chevron.backward"
            accessibilityLabel="Back to default trip"
            onPress={resetDisplayedTrip}
          />
        </Stack.Toolbar>
      ) : null}
      <Stack.Toolbar placement="right">
        {model.showStar ? (
          <Stack.Toolbar.Button
            icon="star"
            separateBackground
            accessibilityLabel="Make favorite"
            onPress={() => setFavorite(model.tripId)}
          />
        ) : null}
        <Stack.Toolbar.Button
          icon="list.bullet"
          accessibilityLabel="Trips"
          onPress={() => router.push('/trips')}
        />
        <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel="More">
          <Stack.Toolbar.MenuAction icon="square.and.arrow.up" onPress={onExport}>
            Export
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="trash" destructive onPress={onDelete}>
            Delete
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {/* Collapsed inline title, centred between the button groups; cross-fades
          in as the large title scrolls under the bar. */}
      <Stack.Title asChild>
        <Animated.View style={[styles.inlineTitle, inlineTitleStyle]}>
          <Text style={[styles.inlineTitleText, { color: text }]} numberOfLines={1}>
            {summary.title}
          </Text>
          <Text style={[styles.inlineSubtitle, { color: subtext }]} numberOfLines={1}>
            {dateRange} · {compactCountdownPillLabel(badge)}
          </Text>
        </Animated.View>
      </Stack.Title>
    </>
  );

  // Expanded large title rendered as the List's first row (SwiftUI content).
  const titleRow = (
    <VStack alignment="leading" spacing={6} modifiers={[padding({ vertical: 4 })]}>
      <SwiftText modifiers={[font({ size: 34, weight: 'bold' }), foregroundStyle(text)]}>
        {summary.title}
      </SwiftText>
      <HStack spacing={8}>
        <SwiftText modifiers={[font({ size: 15 }), foregroundStyle(subtext)]}>
          {dateRange}
        </SwiftText>
        <SwiftText modifiers={[font({ size: 15 }), foregroundStyle(subtext)]}>·</SwiftText>
        <SwiftText
          modifiers={[
            font({ size: 13, weight: 'semibold' }),
            foregroundStyle(WHITE),
            padding({ horizontal: 10, vertical: 3 }),
            glassEffect({ glass: { variant: 'regular', tint: TINT }, shape: 'capsule' }),
            clipShape('capsule'),
          ]}
        >
          {countdownPillLabel(badge)}
        </SwiftText>
      </HStack>
    </VStack>
  );

  if (!trip) {
    return (
      <View style={styles.sheet}>
        {chrome}
        <ActivityIndicator style={styles.loader} size="large" />
      </View>
    );
  }

  return (
    <>
      {chrome}
      <ItineraryPanel trip={trip} titleRow={titleRow} scrollModifier={scrollModifier} />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: 24 },

  inlineTitle: { alignItems: 'center', justifyContent: 'center' },
  inlineTitleText: { fontSize: 16, fontWeight: '700' },
  inlineSubtitle: { fontSize: 11, marginTop: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 34, fontWeight: '700' },
  emptyHint: { marginTop: 8, fontSize: 15, textAlign: 'center' },
});
