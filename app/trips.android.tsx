import { View, Text as RNText, StyleSheet, Alert, useColorScheme, Image } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Host, Column, Card, Surface, Row, Text, Button } from '@expo/ui/jetpack-compose';
import { padding, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

import { useTripStore } from '@/lib/store';
import { useThemeColors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProgressiveBlurView } from '@/components/progressive-blur';
import { partitionTrips } from '@/lib/trip-partition';
import { tripCountdownBadge, countdownPillLabel } from '@/lib/trip-badge';
import { todayString, formatDateRange } from '@/lib/date-utils';
import { wallpaperDisplayUri, exportTripAsFile } from '@/lib/storage';
import type { TripSummary } from '@/lib/schema';

// Android (Material 3) twin of trips.tsx. Same store wiring, partitioning, and
// handlers; only the @expo/ui render tree diverges. The SwiftUI List/Section of
// swipe-action rows becomes a Column of Material Cards — each trip row is a
// tappable Surface (open the trip) with inline Edit / Favorite / Export / Delete
// buttons, since Material has no leading/trailing swipe idiom. The base trips.tsx
// (iOS) is untouched — Metro resolves this variant on Android.

const NAV_BAR_HEIGHT = 64;

export default function TripsSheet() {
  const { trips, activeTripId, setFavorite, clearFavorite, removeTrip, setDisplayedTrip } =
    useTripStore();
  const today = todayString();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const c = useThemeColors();
  const subtext = c.textSubtle;

  // Flat, scannable list: in-progress trips first, then upcoming, each already
  // sorted by start date. Past (archived) trips follow in their own greyed-out
  // section, most recently ended first.
  const { active, archived } = partitionTrips(trips, today);
  const visibleTrips = [...active.inProgress, ...active.upcoming];
  const pastTrips = [...archived].sort((a, b) => b.endDate.localeCompare(a.endDate));
  const hasTrips = visibleTrips.length > 0 || pastTrips.length > 0;

  async function onExport(summary: TripSummary) {
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

  function onDelete(summary: TripSummary) {
    Alert.alert('Delete trip', `Delete "${summary.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeTrip(summary.id) },
    ]);
  }

  function onEdit(summary: TripSummary) {
    router.push(`/trip/${summary.id}/edit`);
  }

  function onTap(summary: TripSummary) {
    // ADR-0001: reuse the single page — set the Displayed Trip in store state
    // rather than pushing a /trip/[id] route. Dismiss the whole sheet stack
    // (trips + days) back to the bare map; index.tsx re-presents the permanent
    // days sheet on focus, which remounts it at its 50% initial detent.
    setDisplayedTrip(summary.id);
    router.dismissAll();
  }

  function onToggleFavorite(summary: TripSummary) {
    if (activeTripId === summary.id) clearFavorite();
    else setFavorite(summary.id);
  }

  // A trip row as a tappable Material Surface inside a Card: a wallpaper (or map
  // fallback) thumbnail, the title + date range + countdown pill, and the inline
  // actions. `muted` dims the row for the Past trips section so finished trips
  // recede and drops the Favorite action (meaningless once a trip has ended).
  function renderRow(summary: TripSummary, muted = false) {
    const wallpaperUri = summary.wallpaperUri ? wallpaperDisplayUri(summary.wallpaperUri) : null;
    const badge = tripCountdownBadge(summary, today);
    const pill = countdownPillLabel(badge);
    const isFavorite = activeTripId === summary.id;

    return (
      <Card key={summary.id} modifiers={[paddingAll(8)]}>
        <Surface onClick={() => onTap(summary)}>
          <Row modifiers={[paddingAll(8)]}>
            {wallpaperUri ? (
              <Image source={{ uri: wallpaperUri }} style={styles.thumb} accessibilityLabel="wallpaper" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: isDark ? '#3a3a3c' : '#e5e5ea' }]}>
                <IconSymbol name="map" size={26} color="#8e8e93" />
              </View>
            )}
            <Column>
              <Row>
                {isFavorite ? <Text color={c.accent}>★</Text> : null}
                <Text style={{ typography: 'titleMedium' }}>{summary.title}</Text>
              </Row>
              <Row>
                <Text color={subtext} style={{ typography: 'bodySmall' }}>
                  {formatDateRange(summary.startDate, summary.endDate)}
                </Text>
                <Text style={{ typography: 'labelSmall' }}>{pill}</Text>
              </Row>
            </Column>
          </Row>
        </Surface>

        <Row modifiers={[paddingAll(4)]}>
          <Button onClick={() => onEdit(summary)}>
            <Text>Edit</Text>
          </Button>
          {/* Favoriting picks the default Displayed Trip — meaningless for a
              finished trip, so the Past trips section drops the action. */}
          {muted ? null : (
            <Button onClick={() => onToggleFavorite(summary)}>
              <Text>{isFavorite ? 'Unfavorite' : 'Favorite'}</Text>
            </Button>
          )}
          <Button onClick={() => onExport(summary)}>
            <Text>Export</Text>
          </Button>
          <Button onClick={() => onDelete(summary)}>
            <Text>Delete</Text>
          </Button>
        </Row>
      </Card>
    );
  }

  // The native navigation bar mirrors the days sheet's Stack.Toolbar chrome: a
  // Settings button on the left, the title, and a New trip / Import menu on the
  // right. Kept as expo-router chrome (Stack.*) identically to iOS.
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>Trips</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="gearshape"
          accessibilityLabel="Settings"
          tintColor={c.accent}
          onPress={() => router.push('/settings')}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="plus" accessibilityLabel="Add trip" tintColor={c.accent}>
          <Stack.Toolbar.MenuAction icon="plus" onPress={() => router.push('/trip/new')}>
            New Trip
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="square.and.arrow.down"
            onPress={() => router.push('/import')}
          >
            Import Trip
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {!hasTrips ? (
        <View style={styles.empty}>
          <RNText style={[styles.emptyText, { color: isDark ? '#8e8e93' : '#6d6d72' }]}>
            No trips yet
          </RNText>
        </View>
      ) : (
        <Host style={styles.host} matchContents>
          <Column modifiers={[padding(16, 12, 16, 12)]}>
            {visibleTrips.map((summary) => renderRow(summary))}
            {pastTrips.length > 0 ? (
              <Column>
                <Text color={subtext} style={{ typography: 'titleSmall' }}>Past trips</Text>
                {pastTrips.map((summary) => renderRow(summary, true))}
              </Column>
            ) : null}
          </Column>
        </Host>
      )}

      {/* Progressive blur behind the transparent nav bar: full strength at the top
          edge, easing to clear by the bar's bottom so list content stays sharp. */}
      <View pointerEvents="none" style={[styles.navBlur, { height: NAV_BAR_HEIGHT }]}>
        <ProgressiveBlurView intensity={20} layers={10} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  host: { flex: 1 },
  navBlur: { position: 'absolute', top: 0, left: 0, right: 0 },

  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16 },
});
