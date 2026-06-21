import { View, Text as RNText, StyleSheet, Alert, useColorScheme } from 'react-native';
import { Stack, router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import {
  Host,
  List,
  Section,
  VStack,
  HStack,
  Spacer,
  Text,
  Image,
  Button,
  SwipeActions,
} from '@expo/ui/swift-ui';
import {
  listStyle,
  font,
  foregroundStyle,
  frame,
  aspectRatio,
  resizable,
  clipShape,
  background,
  padding,
  lineLimit,
  listRowBackground,
  onTapGesture,
  scrollContentBackground,
  tint,
  glassEffect,
  shapes,
  animation,
  Animation,
  grayscale,
  opacity,
} from '@expo/ui/swift-ui/modifiers';

import { useTripStore } from '@/lib/store';
import { useThemeColors } from '@/constants/theme';
import { ProgressiveBlurView } from '@/components/progressive-blur';
import { partitionTrips } from '@/lib/trip-partition';
import { tripCountdownBadge, countdownPillLabel } from '@/lib/trip-badge';
import { todayString, formatDateRange } from '@/lib/date-utils';
import { wallpaperDisplayUri, exportTripAsFile } from '@/lib/storage';
import { t } from '@/lib/i18n';
import type { TripSummary } from '@/lib/schema';

const FAVORITE_GOLD = '#FFD60A';
const WHITE = '#ffffff';
// Height of the progressive-blur band behind the transparent nav bar — spans the
// standard (collapsed) navigation bar at the top of the sheet (mirrors days.tsx).
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
          dialogTitle: t('trips.exportTitle', { title: summary.title }),
        });
      } else {
        Alert.alert(t('trips.sharingUnavailableTitle'), t('trips.sharingUnavailableBody'));
      }
    } catch {
      Alert.alert(t('trips.exportFailedTitle'), t('trips.exportFailedBody'));
    }
  }

  function onDelete(summary: TripSummary) {
    Alert.alert(t('trips.deleteTitle'), t('trips.deleteConfirm', { title: summary.title }), [
      { text: t('trips.cancel'), style: 'cancel' },
      { text: t('trips.delete'), style: 'destructive', onPress: () => removeTrip(summary.id) },
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

  // A trip row as a native SwiftUI list row with swipe actions: leading swipe
  // exposes Edit and the single persisted favorite toggle; trailing swipe exposes
  // Export and Delete. Tapping the row opens the trip. `muted` desaturates and
  // dims the row for the Past trips section so finished trips recede.
  function renderRow(summary: TripSummary, muted = false) {
    const wallpaperUri = summary.wallpaperUri ? wallpaperDisplayUri(summary.wallpaperUri) : null;
    const badge = tripCountdownBadge(summary, today);
    const pill = countdownPillLabel(badge);
    const isFavorite = activeTripId === summary.id;

    return (
      <SwipeActions key={summary.id}>
        <HStack
          spacing={12}
          modifiers={[
            onTapGesture(() => onTap(summary)),
            ...(muted ? [grayscale(1), opacity(0.55)] : []),
          ]}
        >
          {wallpaperUri ? (
            <Image
              uiImage={wallpaperUri}
              modifiers={[
                resizable(),
                aspectRatio({ contentMode: 'fill' }),
                frame({ width: 56, height: 56 }),
                clipShape('roundedRectangle', 12),
              ]}
            />
          ) : (
            <Image
              systemName="map"
              size={26}
              color="#8e8e93"
              modifiers={[
                frame({ width: 56, height: 56 }),
                background(
                  isDark ? '#3a3a3c' : '#e5e5ea',
                  shapes.roundedRectangle({ cornerRadius: 12 }),
                ),
              ]}
            />
          )}

          <VStack alignment="leading" spacing={4}>
            <HStack spacing={5}>
              {isFavorite ? <Image systemName="star.fill" size={12} color={FAVORITE_GOLD} /> : null}
              <Text modifiers={[font({ size: 17, weight: 'semibold' }), lineLimit(1)]}>
                {summary.title}
              </Text>
            </HStack>
            <HStack spacing={8}>
              <Text modifiers={[font({ size: 13 }), foregroundStyle(subtext), lineLimit(1)]}>
                {formatDateRange(summary.startDate, summary.endDate)}
              </Text>
              <Text
                modifiers={[
                  font({ size: 12, weight: 'semibold' }),
                  foregroundStyle(WHITE),
                  padding({ horizontal: 10, vertical: 2 }),
                  glassEffect({ glass: { variant: 'regular', tint: c.accent }, shape: 'capsule' }),
                  clipShape('capsule'),
                ]}
              >
                {pill}
              </Text>
            </HStack>
          </VStack>

          <Spacer />
        </HStack>

        {/* Trailing edge disables full-swipe (allowsFullSwipe={false}) so a long
            swipe can't auto-trigger Delete; the Delete button itself also drops
            role="destructive" (see below) so a plain tap doesn't pre-remove the
            row before the confirm alert. Trailing buttons lay out from the edge
            inward, so [Delete, Export] reads "Export, Delete" left-to-right. */}
        <SwipeActions.Actions edge="leading">
          <Button
            systemImage="pencil"
            label={t('trips.edit')}
            onPress={() => onEdit(summary)}
            modifiers={[tint(c.accent)]}
          />
          {/* Favoriting picks the default Displayed Trip — meaningless for a
              finished trip, so the Past trips section drops the action. */}
          {muted ? null : (
            <Button
              systemImage={isFavorite ? 'star.slash.fill' : 'star.fill'}
              label={isFavorite ? t('trips.unfavorite') : t('trips.favorite')}
              onPress={() => onToggleFavorite(summary)}
              modifiers={[tint(FAVORITE_GOLD)]}
            />
          )}
        </SwipeActions.Actions>
        <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
          {/* No role="destructive": a destructive swipe button plays SwiftUI's
              row-removal animation the instant it's tapped, before our confirm
              alert resolves — so cancelling left the row gone while the store
              still held the trip. Tinting red keeps the destructive look without
              the auto-removal; the row stays until removeTrip actually runs. */}
          <Button
            systemImage="trash"
            label={t('trips.delete')}
            onPress={() => onDelete(summary)}
            modifiers={[tint(c.destructive)]}
          />
          <Button
            systemImage="square.and.arrow.up"
            label={t('trips.export')}
            onPress={() => onExport(summary)}
            modifiers={[tint(c.secondaryAction)]}
          />
        </SwipeActions.Actions>
      </SwipeActions>
    );
  }

  // The native navigation bar mirrors the days sheet's Stack.Toolbar chrome:
  // a Settings button on the left, the title, and a New trip button on the right.
  // The bar itself is transparent — list content scrolls under it and a
  // progressive-blur RN overlay (below) provides the variable-radius frost, since
  // the native bar can only do a uniform blur.
  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
      <Stack.Title>{t('trips.title')}</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          icon="gearshape"
          accessibilityLabel={t('trips.settings')}
          tintColor={c.accent}
          onPress={() => router.push('/settings')}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="plus" accessibilityLabel={t('trips.addTrip')} tintColor={c.accent}>
          <Stack.Toolbar.MenuAction icon="plus" onPress={() => router.push('/trip/new')}>
            {t('trips.new')}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction
            icon="square.and.arrow.down"
            onPress={() => router.push('/import')}
          >
            {t('trips.import')}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      {!hasTrips ? (
        <View style={styles.empty}>
          <RNText style={[styles.emptyText, { color: isDark ? '#8e8e93' : '#6d6d72' }]}>
            {t('trips.empty')}
          </RNText>
        </View>
      ) : (
        // tint() seeds the SwiftUI accent inside the Host — SwiftUI otherwise
        // falls back to system blue. Hiding the List's system grouped background
        // lets the warm container background show through; rows take the surface.
        <Host style={styles.host} colorScheme={isDark ? 'dark' : 'light'} modifiers={[tint(c.accent)]}>
          {/* Animate row insert/removal: SwiftUI's .animation(_:value:) keyed to the
              row count. Removing role="destructive" took away the swipe's built-in
              delete animation, so we drive it here — when removeTrip drops the count
              the row slides out instead of vanishing. */}
          <List
            modifiers={[
              listStyle('insetGrouped'),
              scrollContentBackground('hidden'),
              animation(Animation.default, visibleTrips.length + pastTrips.length),
            ]}
          >
            {visibleTrips.length > 0 ? (
              <Section modifiers={[listRowBackground(c.surface)]}>
                {visibleTrips.map((summary) => renderRow(summary))}
              </Section>
            ) : null}
            {pastTrips.length > 0 ? (
              <Section title={t('trips.pastSection')} modifiers={[listRowBackground(c.surface)]}>
                {pastTrips.map((summary) => renderRow(summary, true))}
              </Section>
            ) : null}
          </List>
        </Host>
      )}

      {/* Progressive blur behind the transparent nav bar: full strength at the top
          edge, easing to clear by the bar's bottom so list content stays sharp. It
          renders within RN content, i.e. beneath the native toolbar buttons/title. */}
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

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 16 },
});
