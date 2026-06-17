import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  runOnUI,
} from 'react-native-reanimated';
import { Stack, router, useNavigation } from 'expo-router';
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
import { useThemeColors } from '@/constants/theme';
import { ItineraryPanel } from '@/components/itinerary-panel';
import { ProgressiveBlurView } from '@/components/progressive-blur';
import { tripHeaderModel } from '@/lib/trip-header';
import {
  tripCountdownBadge,
  countdownPillLabel,
  compactCountdownPillLabel,
} from '@/lib/trip-badge';
import { todayString, formatDateRange } from '@/lib/date-utils';
import { todayFilterModel } from '@/lib/today-filter';
import { MIN_SHEET_DETENT_INDEX } from '@/lib/sheet-detents';

const WHITE = '#ffffff';
// Height of the progressive-blur layer behind the transparent nav bar — the
// screen content already starts at the safe-area top, so this spans just the
// standard (collapsed) navigation bar, not the status-bar inset above it.
const NAV_BAR_HEIGHT = 64;
// Cap the inline title/subtitle width so a long trip name truncates with an
// ellipsis instead of running under the toolbar buttons. Half the sheet width
// leaves a quarter on each side for the (worst-case) back-arrow + Day-filter
// group on the left and the Trips button on the right.
const INLINE_TITLE_MAX_WIDTH = Dimensions.get('window').width * 0.5;

export default function DaysSheet() {
  const {
    trips,
    loadedTrips,
    displayedTripId,
    activeTripId,
    todayFilterOverride,
    sheetDetentIndex,
    initialized,
    loadTripById,
    resetDisplayedTrip,
    setTodayFilterOverride,
    setSheetDetentIndex,
    setSelectedPin,
  } = useTripStore();
  const c = useThemeColors();
  const navigation = useNavigation();

  // Report the sheet's resting detent to the store so the home map can frame the
  // route into the area it leaves visible. iOS only fires this when the detent
  // settles (isStable), so the map reframes on the stable detent, not mid-drag.
  // Expanding the sheet past the XS peek also dismisses any pin info card.
  useEffect(() => {
    const unsubscribe = (
      navigation as unknown as {
        addListener: (
          type: 'sheetDetentChange',
          cb: (e: { data: { index: number; stable: boolean } }) => void,
        ) => () => void;
      }
    ).addListener('sheetDetentChange', (e) => {
      if (!e.data.stable) return;
      setSheetDetentIndex(e.data.index);
      if (e.data.index !== MIN_SHEET_DETENT_INDEX) setSelectedPin(null);
    });
    return unsubscribe;
  }, [navigation, setSheetDetentIndex, setSelectedPin]);
  const text = c.text;
  const subtext = c.textSubtle;

  const today = todayString();
  const model = tripHeaderModel(displayedTripId, trips, activeTripId, today);
  const tripId = model.mode === 'empty' ? null : model.tripId;
  const summary = tripId ? (trips.find((t) => t.id === tripId) ?? null) : null;
  const trip = summary ? (loadedTrips[summary.id] ?? null) : null;

  useEffect(() => {
    if (summary) loadTripById(summary.id);
  }, [summary?.id]);

  // The large title scrolls away as the List's first row. Rather than tracking the
  // scroll continuously, the inline title is a threshold toggle: once the large
  // title has scrolled past the collapse point, `collapsed` animates 0→1 to
  // completion on its own timing (and back when scrolled near the top), so the
  // slide+fade is a discrete transition, not a scrub. Hysteresis (collapse at 20,
  // expand below 6) keeps it from flickering when held right at the edge.
  // (ADR-0002.) Driven on the UI thread by SwiftUI's scroll geometry.
  //
  // The inline title is forced on whenever EITHER the large title has scrolled
  // past the threshold OR the sheet rests at its XS peek detent — at the peek the
  // list is too short to scroll, so the scroll trigger can never fire and the
  // large title has no room. Both inputs feed the same cross-fade; leaving XS
  // reverts to the scroll-derived state. (ADR-0002.)
  const scrolledPast = useSharedValue(false);
  const atXSDetent = useSharedValue(false);
  // The cross-fade target is the OR of the two inputs, animated through withTiming
  // so a flip in either input slides the inline title in (or out) on its own timing.
  const collapsed = useDerivedValue(() =>
    withTiming(scrolledPast.value || atXSDetent.value ? 1 : 0, { duration: 220 }),
  );
  const scrollModifier = useScrollGeometryChange((geometry) => {
    'worklet';
    const y = geometry.contentOffsetY;
    const next = scrolledPast.value ? y > 6 : y > 20;
    if (next !== scrolledPast.value) scrolledPast.value = next;
  });
  // The detent settles on the JS thread (settle-only listener above); push the XS
  // flag to the UI thread so the derived cross-fade reacts. The fade lands as the
  // detent comes to rest, which ADR-0002 accepts.
  useEffect(() => {
    const atXS = sheetDetentIndex === MIN_SHEET_DETENT_INDEX;
    runOnUI(() => {
      atXSDetent.value = atXS;
    })();
  }, [sheetDetentIndex, atXSDetent]);
  // Slide + fade: as the large title scrolls up and out, the inline title rises
  // from 10pt below and fades in — Apple's large→inline cross-fade motion.
  const inlineTitleStyle = useAnimatedStyle(() => ({
    opacity: collapsed.value,
    transform: [{ translateY: (1 - collapsed.value) * 20 }],
  }));

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
            tintColor={c.accent}
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
  const filterModel = trip ? todayFilterModel(trip.days, badge, todayFilterOverride, today) : { canFilter: false, active: false, activeDate: null };

  // The native navigation row: a leading back-arrow while browsing a non-default
  // Trip plus the Day-filter button, and a trailing single Trips button. The
  // per-trip actions (Edit / Make favorite / Export / Delete) live on the trip
  // list's swipe actions, so there is no header overflow menu.
  const showBackArrow = model.showBackArrow;
  const showFilter = filterModel.canFilter || filterModel.active;
  const chrome = (
    <>
      {/* Transparent native bar — the progressive blur behind it is an RN overlay
          (see the return below), since the native bar only does a uniform blur. */}
      <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
        <Stack.Toolbar placement="left">
        {showBackArrow ? (
          <Stack.Toolbar.Button
            icon="chevron.backward"
            accessibilityLabel="Back to default trip"
            tintColor={c.accent}
            // separateBackground gives each its own liquid-glass capsule instead of
            // sharing one with the adjacent filter button (maps to the iOS 26 bar
            // button's sharesBackground=false); a spacer only adds gap, it doesn't
            // split the glass.
            separateBackground
            onPress={() => {
              // Dismiss BEFORE mutating the store so the two motions run together.
              // react-navigation marks this sheet for dismissal first, so the
              // outgoing sheet slides away still showing the current trip rather
              // than snapping in place to the default; the store reset then reframes
              // the map concurrently, and the bare map's focus effect re-presents a
              // fresh sheet (resetting detent + scroll — see index.tsx). Order matters:
              // the reset must land before that re-present focus fires so the fresh
              // sheet opens on the default trip. Mirrors the trips-sheet switch.
              router.dismissAll();
              resetDisplayedTrip();
            }}
          />
        ) : null}
          {/* Always mounted (once the trip is loaded) and toggled via `hidden`, so the
              native toolbar host animates the Day-filter button's show/hide in both
              directions — e.g. it slides in when an Upcoming trip is filtered by a
              Day-header tap. Gating the mount on the loaded trip keeps an eligible
              In-progress trip from animating in on first paint. */}
          {trip ? (
            <Stack.Toolbar.Button
              icon="line.3.horizontal.decrease"
              accessibilityLabel="Filter day"
              tintColor={c.accent}
              selected={filterModel.active}
              hidden={!showFilter}
              separateBackground
              onPress={() => setTodayFilterOverride(!filterModel.active)}
            />
          ) : null}
        </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="list.bullet"
          accessibilityLabel="Trips"
          tintColor={c.accent}
          onPress={() => router.push('/trips')}
        />
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
    <VStack alignment="leading" spacing={6} modifiers={[padding({ bottom: 4 })]}>
      <SwiftText modifiers={[font({ size: 28, weight: 'bold' }), foregroundStyle(text)]}>
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
            glassEffect({ glass: { variant: 'regular', tint: c.accent }, shape: 'capsule' }),
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

  const visibleDays = filterModel.active
    ? trip.days.filter((d) => d.date === filterModel.activeDate)
    : trip.days;

  return (
    <View style={styles.sheet}>
      {chrome}
      <ItineraryPanel
        trip={trip}
        days={visibleDays}
        titleRow={titleRow}
        scrollModifier={scrollModifier}
        // Day-header tap filters the map/list to that day; tapping it again clears.
        onDayPress={(date) => setTodayFilterOverride(filterModel.activeDate === date ? false : date)}
      />
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
  sheet: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loader: { marginTop: 24 },
  navBlur: { position: 'absolute', top: 0, left: 0, right: 0 },

  inlineTitle: { justifyContent: 'center', maxWidth: INLINE_TITLE_MAX_WIDTH },
  inlineTitleText: { fontSize: 16, fontWeight: '700' },
  inlineSubtitle: { fontSize: 11, marginTop: 1, alignSelf: 'flex-start' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 34, fontWeight: '700' },
  emptyHint: { marginTop: 8, fontSize: 15, textAlign: 'center' },
});
