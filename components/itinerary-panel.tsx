import { useMemo, useState, type ReactNode } from 'react';
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
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  listStyle,
  font,
  foregroundStyle,
  listRowBackground,
  listSectionSpacing,
  listSectionMargins,
  onTapGesture,
  scrollPosition,
  id,
  tint,
  animation,
  Animation,
  type BuiltInModifier,
} from '@expo/ui/swift-ui/modifiers';

import type { Trip, Item } from '@/lib/schema';
import type { ItemType } from '@/lib/item-form';
import { useTripStore } from '@/lib/store';
import { formatDayLabel } from '@/lib/date-utils';
import { formatItem } from '@/lib/item-display';
import { resolveNextUp } from '@/lib/next-up';
import { localDateString } from '@/lib/today';
import { openInMaps, type MapsTarget } from '@/lib/maps';
import { MoveToDayOverlay } from './move-to-day-overlay';
import { ItemTypePicker } from './item-type-picker';

const TINT = '#007AFF';
const ORANGE = '#FF9500'; // "Move to another day" swipe action
const DELETE_RED = '#FF3B30';
const WHITE = '#ffffff';
const TRANSPARENT = '#00000000';

// The map destination an item exposes, if any — coordinates and/or an address.
// Only Locations and Accommodations carry one.
function mapsTargetForItem(item: Item): MapsTarget | null {
  let coords: MapsTarget['coords'];
  let address: string | undefined;
  if (item.type === 'location') {
    if (item.lat != null && item.lng != null) coords = { lat: item.lat, lng: item.lng };
    address = item.address;
  } else if (item.type === 'accommodation') {
    address = item.address;
  }
  if (!coords && !address) return null;
  return { coords, address };
}

/**
 * The itinerary rendered with a native SwiftUI `List`: an optional leading
 * `titleRow`, an optional Next-up card, then one `Section` per Day (header + its
 * Item rows in stored order). Sections give the system grouped-list separation
 * between Days. Each Day's rows live in a `List.ForEach` so SwiftUI's
 * drag-to-reorder works within the Day. Rows carry swipe actions only (no context
 * menu — its long-press collides with the reorder gesture); tapping the Next-up
 * card scrolls the List to that Day via `scrollPosition`.
 *
 * `titleRow` is rendered as the List's first row so the large trip title scrolls
 * away naturally under the native header (ADR-0002). `scrollModifier` lets the
 * caller observe the List's scroll geometry (e.g. to cross-fade in a collapsed
 * inline title as the large title scrolls under the bar).
 */
export function ItineraryPanel({
  trip,
  now = new Date(),
  titleRow,
  scrollModifier,
}: {
  trip: Trip;
  now?: Date;
  titleRow?: ReactNode;
  scrollModifier?: BuiltInModifier | null;
}) {
  const colorScheme = useColorScheme();
  const subtext = colorScheme === 'dark' ? '#9a9a9a' : '#888';

  const deleteItem = useTripStore((s) => s.deleteItem);
  const reorderItem = useTripStore((s) => s.reorderItem);
  const moveItem = useTripStore((s) => s.moveItem);
  const preferredMapsApp = useTripStore((s) => s.preferredMapsApp);

  // The Item whose "Move to day" calendar is open, or null when none is.
  const [moveTarget, setMoveTarget] = useState<{ fromDayId: string; itemId: string } | null>(null);

  // The Day whose "add item" type picker is open, or null when none is. `dayNumber`
  // is the 1-based position used to title the picker sheet ("Add to Day N").
  const [addTarget, setAddTarget] = useState<{ dayId: string; dayNumber: number } | null>(null);

  const today = localDateString(now);
  const days = useMemo(
    () => [...trip.days].sort((a, b) => a.date.localeCompare(b.date)),
    [trip.days],
  );
  const nextUp = useMemo(() => resolveNextUp(trip, now), [trip, now]);
  // Total item count across all days — the value the list's removal animation keys off.
  const itemCount = useMemo(() => days.reduce((n, d) => n + d.items.length, 0), [days]);

  // Drives SwiftUI's `.scrollPosition(id:)` — writing a Day id scrolls the List to it.
  const scrollTarget = useNativeState<string | null>(null);
  function scrollToDay(dayId: string) {
    // Writing `.value` is how expo-ui's native state drives the List's scroll position.
    // eslint-disable-next-line react-hooks/immutability
    scrollTarget.value = dayId;
  }

  function openItemEditor(dayId: string, itemId: string) {
    router.push({ pathname: '/trip/[id]/item', params: { id: trip.id, dayId, itemId } });
  }

  function confirmDelete(dayId: string, item: Item) {
    const label = item.type === 'note' ? 'this note' : item.name;
    Alert.alert('Delete item', `Delete "${label}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(trip.id, dayId, item.id) },
    ]);
  }

  // Open the floating calendar to move this item to another Day (a different date).
  function showMoveToDaySheet(fromDayId: string, itemId: string) {
    setMoveTarget({ fromDayId, itemId });
  }

  // A type was picked for the day: close the picker and open the editor to create it.
  function addItemToDay(dayId: string, type: ItemType) {
    setAddTarget(null);
    router.push({
      pathname: '/trip/[id]/item',
      params: { id: trip.id, dayId, type },
    });
  }

  function renderItem(dayId: string, item: Item) {
    const { typeLabel, title, lines } = formatItem(item);
    const edit = () => openItemEditor(dayId, item.id);
    const remove = () => confirmDelete(dayId, item);
    const mapsTarget = mapsTargetForItem(item);

    const openMaps = mapsTarget
      ? () => openInMaps(mapsTarget, { app: preferredMapsApp }).catch(() => {})
      : null;

    return (
      // No context menu: its long-press collides with the List's drag-to-reorder gesture, so
      // every action lives on a swipe instead. Swipe leading reveals Edit (the full-swipe main
      // action) and Move to another day when the trip spans more than one day. Swipe trailing
      // reveals Open in Maps when the item has a destination, and Delete. Tapping the row edits it.
      // The trailing edge disables full-swipe (allowsFullSwipe={false}) so a long swipe can't
      // auto-trigger Delete, and the Delete button drops role="destructive" (see below) so even a
      // plain tap doesn't pre-remove the row before the confirm alert resolves.
      <SwipeActions key={item.id}>
        <VStack alignment="leading" spacing={2} modifiers={[onTapGesture(edit)]}>
          <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(subtext)]}>
            {typeLabel.toUpperCase()}
          </Text>
          <Text modifiers={[font({ size: 16, weight: 'semibold' })]}>{title}</Text>
          {lines.map((line, i) => (
            <Text key={i} modifiers={[font({ size: 14 }), foregroundStyle(subtext)]}>
              {line}
            </Text>
          ))}
        </VStack>

        <SwipeActions.Actions edge="leading">
          <Button systemImage="pencil" label="Edit" onPress={edit} modifiers={[tint(TINT)]} />
          {days.length > 1 ? (
            <Button
              systemImage="calendar"
              label="Change day"
              onPress={() => showMoveToDaySheet(dayId, item.id)}
              modifiers={[tint(ORANGE)]}
            />
          ) : null}
        </SwipeActions.Actions>
        <SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
          {openMaps ? (
            <Button
              systemImage="map"
              label="Navigate"
              onPress={openMaps}
              modifiers={[tint(TINT)]}
            />
          ) : null}
          {/* No role="destructive": it plays SwiftUI's row-removal animation on tap,
              before the confirm alert resolves, so cancelling left the row gone. Red
              tint keeps the look; the row stays until deleteItem actually runs. */}
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
            scrollPosition(scrollTarget, { anchor: 'top' }),
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

          {nextUp ? renderNextUp(trip, nextUp, scrollToDay) : null}

          {days.map((day, index) => (
            <Section
              key={day.id}
              modifiers={[id(day.id)]}
              header={
                <VStack alignment="leading" spacing={2}>
                  <HStack spacing={8}>
                    <Text
                      modifiers={[
                        font({ size: 18, weight: 'bold' }),
                        foregroundStyle(day.date === today ? TINT : subtext),
                      ]}
                    >
                      {`Day ${index + 1}`}
                    </Text>
                    <Text modifiers={[font({ size: 14 }), foregroundStyle(subtext)]}>
                      {formatDayLabel(day.date)}
                    </Text>
                    <Spacer />
                    {/* "+" opens the colorful 2×2 card-grid type picker (rendered
                        below) in place of the old plain native Menu. */}
                    <Button
                      systemImage="plus"
                      onPress={() => setAddTarget({ dayId: day.id, dayNumber: index + 1 })}
                    />
                  </HStack>
                  {day.notes ? (
                    <Text modifiers={[font({ size: 14 }), foregroundStyle(subtext)]}>
                      {day.notes}
                    </Text>
                  ) : null}
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
                {day.items.map((item) => renderItem(day.id, item))}
              </List.ForEach>
            </Section>
          ))}
        </List>
      </Host>

      {addTarget ? (
        <ItemTypePicker
          dayNumber={addTarget.dayNumber}
          onSelect={(type) => addItemToDay(addTarget.dayId, type)}
          onClose={() => setAddTarget(null)}
        />
      ) : null}

      {moveTarget ? (
        <MoveToDayOverlay
          trip={trip}
          fromDayId={moveTarget.fromDayId}
          itemId={moveTarget.itemId}
          onMove={(targetDayId) =>
            moveItem(trip.id, moveTarget.fromDayId, targetDayId, moveTarget.itemId)
          }
          onClose={() => setMoveTarget(null)}
        />
      ) : null}
    </View>
  );
}

// The Next-up card: a single blue-backed row at the top of the List naming the
// next item; tapping it scrolls the List down to that item's Day.
function renderNextUp(
  trip: Trip,
  nextUp: { dayId: string; itemId: string },
  scrollToDay: (dayId: string) => void,
) {
  const item = trip.days
    .find((d) => d.id === nextUp.dayId)
    ?.items.find((i) => i.id === nextUp.itemId);
  if (!item) return null;
  const { typeLabel, title, lines } = formatItem(item);

  return (
    <Section modifiers={[listSectionMargins({ edges: 'top', length: 16 })]}>
      <VStack
        alignment="leading"
        spacing={2}
        modifiers={[onTapGesture(() => scrollToDay(nextUp.dayId)), listRowBackground(TINT)]}
      >
        <Text modifiers={[font({ size: 11, weight: 'bold' }), foregroundStyle(WHITE)]}>Next up</Text>
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(WHITE)]}>
          {typeLabel.toUpperCase()}
        </Text>
        <Text modifiers={[font({ size: 18, weight: 'bold' }), foregroundStyle(WHITE)]}>{title}</Text>
        {lines[0] ? <Text modifiers={[foregroundStyle(WHITE)]}>{lines[0]}</Text> : null}
      </VStack>
    </Section>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  host: { flex: 1 },
});
