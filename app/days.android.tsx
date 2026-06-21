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
import { Column, Row, Text as ComposeText } from '@expo/ui/jetpack-compose';
import { padding } from '@expo/ui/jetpack-compose/modifiers';

import { useTripStore } from '@/lib/store';
import { useThemeColors } from '@/constants/theme';
import { ItineraryPanel } from '@/components/itinerary-panel';
import { ProgressiveBlurView } from '@/components/progressive-blur';
import { GlassButton } from '@/components/glass-button';
import { tripHeaderModel } from '@/lib/trip-header';
import {
  tripCountdownBadge,
  countdownPillLabel,
  compactCountdownPillLabel,
} from '@/lib/trip-badge';
import { todayString, formatDateRange } from '@/lib/date-utils';
import { todayFilterModel } from '@/lib/today-filter';
import { MIN_SHEET_DETENT_INDEX } from '@/lib/sheet-detents';
import { SheetHeader, SheetHeaderIconButton } from '@/components/ui/sheet-header';

// Android (Material 3) twin of days.tsx. Same store wiring, same expo-router
// chrome, same handlers (day select / Day filter toggle / add item via the
// ItineraryPanel onDayPress), and the same shared lib calls. Only the expanded
// large-title render tree diverges: the SwiftUI VStack/HStack/Text becomes a
// Compose Column/Row/Text (ADR-0015). The base days.tsx (iOS) is untouched —
// Metro resolves this variant on Android.

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
  // (ADR-0002.)
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
  // from 10pt below and fades in — the large→inline cross-fade motion.
  const inlineTitleStyle = useAnimatedStyle(() => ({
    opacity: collapsed.value,
    transform: [{ translateY: (1 - collapsed.value) * 20 }],
  }));

  if (!initialized) {
    return (
      <View style={styles.center}>
        {/* Render the header even while loading so its visibility stays constant
            across every branch — toggling header visibility in a formSheet
            remounts the screen (RN screens warning). */}
        <Stack.Header style={{ backgroundColor: 'transparent', shadowColor: 'transparent' }} />
        <Stack.Title>{''}</Stack.Title>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Empty state: a single Trips button (the gateway to Settings / Archived /
  // Import) and a non-collapsing "On the Road" title with New / Import Trip
  // buttons right on the sheet — no star, back, or overflow. The bar matches the
  // other sheets: transparent with an RN progressive-blur overlay (below), and an
  // empty title so the native bar doesn't fall back to the "days" route name.
  if (model.mode === 'empty' || !summary) {
    return (
      <View style={styles.sheet}>
        {/* In-content Material header: react-native-screens drops the native
            header/Stack.Toolbar on Android formSheets, so the Trips action lives
            in the sheet body (see SheetHeader). */}
        <SheetHeader
          right={
            <SheetHeaderIconButton
              icon="list.bullet"
              accent={c.accent}
              accessibilityLabel="Trips"
              onPress={() => router.push('/trips')}
            />
          }
        />
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: text }]}>On the Road</Text>
          <Text style={[styles.emptyHint, { color: subtext }]}>
            Start a new trip or import one you already have.
          </Text>
          <View style={styles.emptyButtons}>
            <GlassButton
              label="New Trip"
              icon="plus"
              accent={c.accent}
              onPress={() => router.push('/trip/new')}
            />
            <GlassButton
              label="Import Trip"
              icon="square.and.arrow.down"
              accent={c.accent}
              onPress={() => router.push('/import')}
            />
          </View>
        </View>
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
  // In-content Material header, absolutely positioned so the large title (the
  // list's first row) scrolls *under* it and the inline title cross-fades in —
  // react-native-screens drops the native header/Stack.Toolbar on Android
  // formSheets, so this replaces it (see SheetHeader). The progressive blur behind
  // it is the RN overlay rendered in the return below.
  const chrome = (
    <SheetHeader
      style={styles.headerOverlay}
      left={
        <>
          {showBackArrow ? (
            <SheetHeaderIconButton
              icon="chevron.backward"
              accessibilityLabel="Back to default trip"
              accent={c.accent}
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
          {/* Mounted once the trip is loaded and toggled via `hidden` so the
              Day-filter button's show/hide stays stable. */}
          {trip ? (
            <SheetHeaderIconButton
              icon="line.3.horizontal.decrease"
              accessibilityLabel="Filter day"
              accent={c.accent}
              selected={filterModel.active}
              hidden={!showFilter}
              onPress={() => setTodayFilterOverride(!filterModel.active)}
            />
          ) : null}
        </>
      }
      titleNode={
        <Animated.View style={[styles.inlineTitle, inlineTitleStyle]}>
          <Text style={[styles.inlineTitleText, { color: text }]} numberOfLines={1}>
            {summary.title}
          </Text>
          <Text style={[styles.inlineSubtitle, { color: subtext }]} numberOfLines={1}>
            {dateRange} · {compactCountdownPillLabel(badge)}
          </Text>
        </Animated.View>
      }
      right={
        <SheetHeaderIconButton
          icon="list.bullet"
          accessibilityLabel="Trips"
          accent={c.accent}
          onPress={() => router.push('/trips')}
        />
      }
    />
  );

  // Expanded large title rendered as the List's first row. On Android this is a
  // Material Column/Row/Text instead of the SwiftUI VStack/HStack used on iOS;
  // the data and modifiers (Day-header tap behaviour, the countdown pill text)
  // are identical.
  const titleRow = (
    <Column modifiers={[padding(0, 0, 0, 4)]}>
      <ComposeText color={text} style={{ typography: 'headlineMedium' }}>
        {summary.title}
      </ComposeText>
      <Row modifiers={[padding(0, 4, 0, 0)]}>
        <ComposeText color={subtext} style={{ typography: 'bodyMedium' }}>
          {dateRange}
        </ComposeText>
        <ComposeText color={subtext} style={{ typography: 'bodyMedium' }}>
          {' · '}
        </ComposeText>
        <ComposeText color={c.accent} style={{ typography: 'labelMedium' }}>
          {countdownPillLabel(badge)}
        </ComposeText>
      </Row>
    </Column>
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
  // The in-content header floats over the scrolling list so the large title
  // scrolls under it (zIndex keeps it above the list + progressive blur).
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },

  inlineTitle: { justifyContent: 'center', maxWidth: INLINE_TITLE_MAX_WIDTH },
  inlineTitleText: { fontSize: 16, fontWeight: '700' },
  inlineSubtitle: { fontSize: 11, marginTop: 1, alignSelf: 'flex-start' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 34, fontWeight: '700' },
  emptyHint: { marginTop: 8, fontSize: 15, textAlign: 'center' },
  // The two trip affordances sit side by side, wrapping on a narrow screen —
  // mirrors the Import sheet's button row.
  emptyButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 24,
  },
});
