import { useMemo, type ReactNode } from 'react';
import { View, StyleSheet, Alert, useColorScheme } from 'react-native';
import { router } from 'expo-router';
import {
  Host,
  List,
  Section,
  VStack,
  HStack,
  Spacer,
  Text,
  Button,
  SwipeActions,
  Image,
} from '@expo/ui/swift-ui';
import {
  listStyle,
  font,
  foregroundStyle,
  listRowBackground,
  listSectionSpacing,
  listSectionMargins,
  onTapGesture,
  tint,
  animation,
  Animation,
  contentTransition,
  accessibilityLabel,
  background,
  padding,
  shapes,
  type BuiltInModifier,
} from '@expo/ui/swift-ui/modifiers';
import type { Trip, Item } from '@/lib/schema';
import { useTripStore } from '@/lib/store';
import { formatDayLabel } from '@/lib/date-utils';
import { formatItem } from '@/lib/item-display';
import { checklistProgress } from '@/lib/checklist';
import { resolveNextUp } from '@/lib/next-up';
import { localDateString } from '@/lib/today';
import { openInMaps, MAPS_APP_LABELS, type MapsTarget } from '@/lib/maps';
const TINT = '#007AFF';
const FAINT_BLUE = '#007AFF1A'; // ~10% opacity — today's section background
const DELETE_RED = '#FF3B30';
const WHITE = '#ffffff';
const TRANSPARENT = '#00000000';

// The map destination an item exposes, if any — coordinates and/or an address.
// Any category can carry a location sub-object.
function mapsTargetForItem(item: Item): MapsTarget | null {
  if (!item.location) return null;
  const { lat, lng, address } = item.location;
  const coords = lat != null && lng != null ? { lat, lng } : undefined;
  if (!coords && !address) return null;
  return { coords, address };
}

/**
 * The itinerary rendered with a native SwiftUI `List`: an optional leading
 * `titleRow`, then one `Section` per Day (header + its Item rows in stored order).
 * Sections give the system grouped-list separation between Days. Each Day's rows
 * live in a `List.ForEach` so SwiftUI's drag-to-reorder works within the Day. Rows
 * carry swipe actions only (no context menu — its long-press collides with the
 * reorder gesture). On the day that's underway, the whole section gets a faint
 * blue fill and a TINT-blue "Day X" header, and the next-up item is highlighted
 * in-place with a solid TINT-blue row and a "NEXT UP" pill.
 *
 * `titleRow` is rendered as the List's first row so the large trip title scrolls
 * away naturally under the native header (ADR-0002). `scrollModifier` lets the
 * caller observe the List's scroll geometry (e.g. to cross-fade in a collapsed
 * inline title as the large title scrolls under the bar).
 */
export function ItineraryPanel({
  trip,
  days: daysProp,
  now = new Date(),
  titleRow,
  scrollModifier,
  onDayPress,
}: {
  trip: Trip;
  days?: import('@/lib/schema').Day[];
  now?: Date;
  titleRow?: ReactNode;
  scrollModifier?: BuiltInModifier | null;
  onDayPress?: (date: string) => void;
}) {
  const colorScheme = useColorScheme();
  const subtext = colorScheme === 'dark' ? '#9a9a9a' : '#888';

  const deleteItem = useTripStore((s) => s.deleteItem);
  const reorderItem = useTripStore((s) => s.reorderItem);
  const toggleChecklistEntry = useTripStore((s) => s.toggleChecklistEntry);
  const preferredMapsApp = useTripStore((s) => s.preferredMapsApp);

  const today = localDateString(now);
  // allDays is always the full sorted trip days — used for "Day N" numbering.
  const allDays = useMemo(
    () => [...trip.days].sort((a, b) => a.date.localeCompare(b.date)),
    [trip.days],
  );
  // dayPosition maps day.id → 1-based trip position so "Day 5" stays "Day 5" when filtered.
  const dayPosition = useMemo(
    () => new Map(allDays.map((d, i) => [d.id, i + 1])),
    [allDays],
  );
  // days is the list to render — filtered when daysProp is provided, full otherwise.
  const days = useMemo(
    () => daysProp
      ? [...daysProp].sort((a, b) => a.date.localeCompare(b.date))
      : allDays,
    [daysProp, allDays],
  );
  const nextUp = useMemo(() => resolveNextUp(trip, now), [trip, now]);
  // Total item count across all days — the value the list's removal animation keys off.
  const itemCount = useMemo(() => days.reduce((n, d) => n + d.items.length, 0), [days]);

  function openItemEditor(dayId: string, itemId: string) {
    router.push({ pathname: '/trip/[id]/item', params: { id: trip.id, dayId, itemId } });
  }

  function confirmDelete(dayId: string, item: Item) {
    const label = item.name;
    Alert.alert('Delete item', `Delete "${label}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(trip.id, dayId, item.id) },
    ]);
  }

  // Open the editor on the create path for this day. No category is passed, so the
  // editor opens on its default ("activity"); the segmented picker can change it.
  function addItemToDay(dayId: string) {
    router.push({
      pathname: '/trip/[id]/item',
      params: { id: trip.id, dayId },
    });
  }

  function renderItem(
    dayId: string,
    item: Item,
    { isNextUp, isToday }: { isNextUp: boolean; isToday: boolean },
  ) {
    const { typeLabel, title, lines } = formatItem(item);
    const edit = () => openItemEditor(dayId, item.id);
    const remove = () => confirmDelete(dayId, item);
    const mapsTarget = mapsTargetForItem(item);

    const openMaps = mapsTarget
      ? () => openInMaps(mapsTarget, { app: preferredMapsApp }).catch(() => {})
      : null;

    const checklist = item.checklist ?? [];
    // A leading circle that fills into a checkmark when ticked. Only the circle
    // owns the tap (not the whole line), and it writes straight through to
    // storage — so it sits outside the header's edit tap gesture. The
    // contentTransition + animation pair animates the circle → checkmark swap.
    const checklistRows = (palette: { tick: string; idle: string; label?: string }) =>
      checklist.map((entry) => (
        <HStack key={entry.id} spacing={10}>
          <Image
            systemName={entry.checked ? 'checkmark.circle.fill' : 'circle'}
            color={entry.checked ? palette.tick : palette.idle}
            size={20}
            modifiers={[
              contentTransition('interpolate'),
              animation(Animation.default, entry.checked ? 1 : 0),
              accessibilityLabel(entry.label),
              onTapGesture(() => toggleChecklistEntry(trip.id, dayId, item.id, entry.id)),
            ]}
          />
          <Text
            modifiers={[
              font({ size: 14 }),
              ...(palette.label ? [foregroundStyle(palette.label)] : []),
            ]}
          >
            {entry.label}
          </Text>
          <Spacer />
        </HStack>
      ));

    const progress = (color: string) =>
      checklist.length > 0 ? (
        <HStack spacing={3}>
          <Image systemName="checklist" color={color} size={10} />
          <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(color)]}>
            {checklistProgress(checklist)}
          </Text>
        </HStack>
      ) : null;

    const rowContent = isNextUp ? (
      // Solid TINT-blue row with a white capsule "NEXT UP" pill in upper-right.
      // The pill uses TINT text on white background to stay in the blue family.
      <VStack alignment="leading" spacing={6} modifiers={[listRowBackground(TINT)]}>
        <HStack alignment="top" spacing={8} modifiers={[onTapGesture(edit)]}>
          <VStack alignment="leading" spacing={2}>
            <HStack spacing={8}>
              <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(WHITE)]}>
                {typeLabel.toUpperCase()}
              </Text>
              {progress(WHITE)}
            </HStack>
            <Text modifiers={[font({ size: 16, weight: 'semibold' }), foregroundStyle(WHITE)]}>
              {title}
            </Text>
            {lines.map((line, i) => (
              <Text key={i} modifiers={[font({ size: 14 }), foregroundStyle(WHITE)]}>
                {line}
              </Text>
            ))}
          </VStack>
          <Spacer />
          <Text
            modifiers={[
              font({ size: 10, weight: 'bold' }),
              foregroundStyle(TINT),
              padding({ horizontal: 8, vertical: 4 }),
              background(WHITE, shapes.capsule()),
            ]}
          >
            NEXT UP
          </Text>
        </HStack>
        {checklistRows({ tick: WHITE, idle: WHITE, label: WHITE })}
      </VStack>
    ) : (
      <VStack
        alignment="leading"
        spacing={6}
        modifiers={isToday ? [listRowBackground(FAINT_BLUE)] : []}
      >
        <VStack alignment="leading" spacing={2} modifiers={[onTapGesture(edit)]}>
          <HStack spacing={8}>
            <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(subtext)]}>
              {typeLabel.toUpperCase()}
            </Text>
            {progress(subtext)}
          </HStack>
          <Text modifiers={[font({ size: 16, weight: 'semibold' })]}>{title}</Text>
          {lines.map((line, i) => (
            <Text key={i} modifiers={[font({ size: 14 }), foregroundStyle(subtext)]}>
              {line}
            </Text>
          ))}
        </VStack>
        {checklistRows({ tick: TINT, idle: subtext })}
      </VStack>
    );

    return (
      <SwipeActions key={item.id}>
        {rowContent}

        <SwipeActions.Actions edge="leading">
          <Button systemImage="pencil" label="Edit" onPress={edit} modifiers={[tint(TINT)]} />
        </SwipeActions.Actions>
        <SwipeActions.Actions edge="trailing" allowsFullSwipe={!!openMaps}>
          {openMaps ? (
            <Button
              systemImage="map"
              label="Navigate"
              onPress={openMaps}
              modifiers={[tint(TINT)]}
            />
          ) : null}
          <Button systemImage="trash" label="Delete" onPress={remove} modifiers={[tint(DELETE_RED)]} />
        </SwipeActions.Actions>
      </SwipeActions>
    );
  }

  return (
    <View style={styles.container}>
      <Host style={styles.host} colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}>
        <List
          modifiers={[
            listStyle('insetGrouped'),
            // Animate row insert/removal: SwiftUI's .animation(_:value:) keyed to the
            // total item count. Dropping role="destructive" removed the swipe's built-in
            // delete animation, so we drive it here — when deleteItem lowers the count
            // the row slides out instead of vanishing.
            animation(Animation.default, itemCount),
            ...(scrollModifier ? [scrollModifier] : []),
          ]}
        >
          {/* Leading large title as the first row, so it scrolls away under the
              native header instead of being pinned by `Stack.Title large`. The zeroed
              section margin plus a negative top row inset pull the title flush to the
              top, cancelling the inset-grouped list's residual leading gap. */}
          {titleRow ? (
            <Section
              modifiers={[
                listSectionSpacing(0),
                listSectionMargins({ edges: 'top', length: 0 }),
                listRowBackground(TRANSPARENT)
              ]}
            >
              {titleRow}
            </Section>
          ) : null}

          {days.map((day) => (
            <Section
              key={day.id}
              header={
                <VStack alignment="leading" spacing={2}>
                  <HStack
                    spacing={8}
                    // Tapping a day header filters the map/list to that day
                    // (toggles off on a second tap). The + Button still wins
                    // its own taps over the row gesture.
                    modifiers={onDayPress ? [onTapGesture(() => onDayPress(day.date))] : []}
                  >
                    <Text
                      modifiers={[
                        font({ size: 18, weight: 'bold' }),
                        foregroundStyle(day.date === today ? TINT : subtext),
                      ]}
                    >
                      {`Day ${dayPosition.get(day.id) ?? '?'}`}
                    </Text>
                    <Text modifiers={[font({ size: 14 }), foregroundStyle(subtext)]}>
                      {formatDayLabel(day.date)}
                    </Text>
                    <Spacer />
                    <Button
                      systemImage="plus"
                      label=""
                      onPress={() => addItemToDay(day.id)}
                    />
                  </HStack>
                </VStack>
              }
            >
              {/* List.ForEach bridges SwiftUI's drag-to-reorder; `onMove` fires within
                  this Day only. Cross-day moves stay on the row's "Move to another day" swipe. */}
              <List.ForEach
                onMove={(sourceIndices, destination) =>
                  reorderItem(trip.id, day.id, sourceIndices, destination)
                }
              >
                {day.items.map((item) =>
                  renderItem(day.id, item, {
                    isNextUp: nextUp?.dayId === day.id && nextUp?.itemId === item.id,
                    isToday: day.date === today,
                  }),
                )}
              </List.ForEach>
            </Section>
          ))}
        </List>
      </Host>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  host: { flex: 1 },
});
