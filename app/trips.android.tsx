import { View, Text as RNText, StyleSheet, Alert, useColorScheme, Image } from 'react-native';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Host, Column, Card, Surface, Row, Text, TextButton } from '@expo/ui/jetpack-compose';
import { padding, paddingAll, alpha, fillMaxWidth, weight, clip, Shapes } from '@expo/ui/jetpack-compose/modifiers';

import { useTripStore } from '@/lib/store';
import { useThemeColors } from '@/constants/theme';
import { androidMaterial, androidHostTheme } from '@/constants/android-material';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { SheetHeader, SheetHeaderIconButton, SheetHeaderMenu } from '@/components/ui/sheet-header';
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

export default function TripsSheet() {
  const { trips, activeTripId, setFavorite, clearFavorite, removeTrip, setDisplayedTrip } =
    useTripStore();
  const today = todayString();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const scheme = isDark ? 'dark' : 'light';
  const c = useThemeColors();
  const subtext = c.textSubtle;
  const m = androidMaterial(c);

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
      // Past trips recede: dim the whole row (mirrors the iOS opacity(0.55) on the
      // archived section) so finished trips read as inactive.
      <Card
        key={summary.id}
        modifiers={muted ? [fillMaxWidth(), paddingAll(8), alpha(0.55)] : [fillMaxWidth(), paddingAll(8)]}
        colors={m.card}
      >
        {/* Transparent so the tappable row blends into the Card rather than
            drawing its own inset box. */}
        <Surface onClick={() => onTap(summary)} color="#00000000" modifiers={[fillMaxWidth()]}>
          <Row modifiers={[fillMaxWidth(), paddingAll(8)]} horizontalArrangement={{ spacedBy: 12 }} verticalAlignment="center">
            {wallpaperUri ? (
              <Image source={{ uri: wallpaperUri }} style={styles.thumb} accessibilityLabel="wallpaper" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: c.separator }]}>
                <IconSymbol name="map" size={26} color={c.textSubtle} />
              </View>
            )}
            <Column modifiers={[weight(1)]} verticalArrangement={{ spacedBy: 4 }}>
              <Row horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">
                {isFavorite ? <Text color={c.accent}>★</Text> : null}
                <Text color={c.text} style={{ typography: 'titleMedium' }}>{summary.title}</Text>
              </Row>
              <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
                <Text color={subtext} style={{ typography: 'bodySmall' }}>
                  {formatDateRange(summary.startDate, summary.endDate)}
                </Text>
                {pill ? (
                  <Surface color={c.accentFaint} modifiers={[clip(Shapes.RoundedCorner(999))]}>
                    <Text color={c.accent} style={{ typography: 'labelSmall' }} modifiers={[padding(8, 3, 8, 3)]}>
                      {pill}
                    </Text>
                  </Surface>
                ) : null}
              </Row>
            </Column>
          </Row>
        </Surface>

        <Row modifiers={[fillMaxWidth(), paddingAll(4)]} horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
          <TextButton onClick={() => onEdit(summary)} colors={m.textButton}>
            <Text>Edit</Text>
          </TextButton>
          {/* Favoriting picks the default Displayed Trip — meaningless for a
              finished trip, so the Past trips section drops the action. */}
          {muted ? null : (
            <TextButton onClick={() => onToggleFavorite(summary)} colors={m.textButton}>
              <Text>{isFavorite ? 'Unfavorite' : 'Favorite'}</Text>
            </TextButton>
          )}
          <TextButton onClick={() => onExport(summary)} colors={m.textButton}>
            <Text>Export</Text>
          </TextButton>
          <TextButton onClick={() => onDelete(summary)} colors={m.destructiveButton}>
            <Text>Delete</Text>
          </TextButton>
        </Row>
      </Card>
    );
  }

  // In-content Material header (react-native-screens drops the native
  // header/Stack.Toolbar on Android formSheets): Settings on the left, the title,
  // and a New trip / Import menu on the right. See SheetHeader.
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <SheetHeader
        title="Trips"
        left={
          <SheetHeaderIconButton
            icon="gearshape"
            accent={c.accent}
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
          />
        }
        right={
          <SheetHeaderMenu
            icon="plus"
            accent={c.accent}
            accessibilityLabel="Add trip"
            actions={[
              { label: 'New Trip', icon: 'plus', onPress: () => router.push('/trip/new') },
              {
                label: 'Import Trip',
                icon: 'square.and.arrow.down',
                onPress: () => router.push('/import'),
              },
            ]}
          />
        }
      />

      {!hasTrips ? (
        <View style={styles.empty}>
          <RNText style={[styles.emptyText, { color: c.textSubtle }]}>
            No trips yet
          </RNText>
        </View>
      ) : (
        // vertical-only matchContents: full `matchContents` wraps width too, shrinking
        // each trip Card to its content; matching height only lets width fill the sheet.
        <Host style={styles.host} matchContents={{ vertical: true }} {...androidHostTheme(c, scheme)}>
          <Column modifiers={[padding(16, 12, 16, 12)]} verticalArrangement={{ spacedBy: 12 }}>
            {visibleTrips.map((summary) => renderRow(summary))}
            {pastTrips.length > 0 ? (
              <Column verticalArrangement={{ spacedBy: 12 }}>
                <Text color={subtext} style={{ typography: 'titleSmall' }}>Past trips</Text>
                {pastTrips.map((summary) => renderRow(summary, true))}
              </Column>
            ) : null}
          </Column>
        </Host>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  host: { flex: 1 },

  thumb: { width: 56, height: 56, borderRadius: 12 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16 },
});
