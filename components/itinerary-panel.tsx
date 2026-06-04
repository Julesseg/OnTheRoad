import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
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
  Image,
  Menu,
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
import { itemIdentity } from '@/lib/item-identity';
import { useTripStore } from '@/lib/store';
import { formatDayLabel } from '@/lib/date-utils';
import { formatItem } from '@/lib/item-display';
import { resolveNextUp } from '@/lib/next-up';
import { localDateString } from '@/lib/today';
import { openInMaps, MAPS_APP_LABELS, type MapsTarget } from '@/lib/maps';
import { MoveToDayOverlay } from './move-to-day-overlay';

const TINT = '#007AFF';
const FAINT_BLUE = '#007AFF1A'; // ~10% opacity — today's section background
const ORANGE = '#FF9500'; // "Move to another day" swipe action
const DELETE_RED = '#FF3B30';
const WHITE = '#ffffff';
const TRANSPARENT = '#00000000';

// Item types offered when adding to a day, in canonical order. Each option's warm
// label and SF Symbol come from the shared item-identity module so the menu stays in
// lockstep with the editor and any other surface that names a type.
const ADD_ITEM_TYPES: ItemType[] = ['location', 'accommodation', 'activity', 'note'];

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
 * `titleRow`, then one `Section` per Day (header + its Item rows in stored order).
 * Sections give the system grouped-list separation between Days. Each Day's rows
 * live in a `List.ForEach` so SwiftUI's drag-to-reorder works within the Day. Rows
 * carry swipe actions only (no context menu — its long-press collides with the
 * reorder gesture). When the trip is In progress the list auto-scrolls on present
 * to center the next-up item (or show today's header) via `scrollPosition`.
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

  const today = localDateString(now);
  const days = useMemo(
    () => [...trip.days].sort((a, b) => a.date.localeCompare(b.date)),
    [trip.days],
  );
  const nextUp = useMemo(() => resolveNextUp(trip, now), [trip, now]);
  // Total item count across all days — the value the list's removal animation keys off.
  const itemCount = useMemo(() => days.reduce((n, d) => n + d.items.length, 0), [days]);

  const isInProgress = today >= trip.startDate && today <= trip.endDate;

  // Drives SwiftUI's `.scrollPosition(id:)` — writing an id scrolls the List to that row.
  const scrollTarget = useNativeState<string | null>(null);

  // Auto-scroll once on sheet presentation: center on next-up item, or top of today's header.
  const hasAutoScrolled = useRef(false);
  useEffect(() => {
    if (hasAutoScrolled.current || !isInProgress) return;
    hasAutoScrolled.current = true;
    if (nextUp) {
      // eslint-disable-next-line react-hooks/immutability
      scrollTarget.value = nextUp.itemId;
    } else {
      const todayDay = days.find((d) => d.date === today);
      if (todayDay) {
        // eslint-disable-next-line react-hooks/immutability
        scrollTarget.value = todayDay.id;
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional mount-once

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

  // Pick an item type for the day, then open the editor to create it.
  function addItemToDay(dayId: string, type: ItemType) {
    router.push({
      pathname: '/trip/[id]/item',
      params: { id: trip.id, dayId, type },
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

    const rowContent = isNextUp ? (
      // Solid TINT-blue row with "NEXT UP" pill in upper-right; stays in blue family, no type accent.
      <HStack
        alignment="top"
        spacing={8}
        modifiers={[onTapGesture(edit), id(item.id), listRowBackground(TINT)]}
      >
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle(WHITE)]}>
            {typeLabel.toUpperCase()}
          </Text>
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
        <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle(WHITE)]}>
          NEXT UP
        </Text>
      </HStack>
    ) : (
      <VStack
        alignment="leading"
        spacing={2}
        modifiers={[
          onTapGesture(edit),
          id(item.id),
          ...(isToday ? [listRowBackground(FAINT_BLUE)] : []),
        ]}
      >
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
    );

    return (
      <SwipeActions key={item.id}>
        {rowContent}

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
            scrollPosition(scrollTarget, { anchor: isInProgress && nextUp ? 'center' : 'top' }),
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
                    <Menu label={<Image systemName="plus" size={20} />}>
                      {ADD_ITEM_TYPES.map((t) => {
                        const identity = itemIdentity(t);
                        return (
                          <Button
                            key={t}
                            label={identity.label}
                            systemImage={identity.symbol}
                            onPress={() => addItemToDay(day.id, t)}
                          />
                        );
                      })}
                    </Menu>
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  host: { flex: 1 },
});
