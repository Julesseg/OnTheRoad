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
  Image,
  Menu,
  SwipeActions,
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
  background,
  padding,
  shapes,
  type BuiltInModifier,
} from '@expo/ui/swift-ui/modifiers';
import type { Trip, Item, ItemCategory } from '@/lib/schema';
import { itemIdentity, ITEM_IDENTITY } from '@/lib/item-identity';
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

// Categories offered when adding an item to a day, in canonical order.
const ADD_ITEM_TYPES = Object.keys(ITEM_IDENTITY) as ItemCategory[];

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
}: {
  trip: Trip;
  days?: import('@/lib/schema').Day[];
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

  // Open the floating calendar to move this item to another Day (a different date).
  function showMoveToDaySheet(fromDayId: string, itemId: string) {
    setMoveTarget({ fromDayId, itemId });
  }

  // Pick a category for the new item, then open the editor to create it.
  function addItemToDay(dayId: string, category: ItemCategory) {
    router.push({
      pathname: '/trip/[id]/item',
      params: { id: trip.id, dayId, category },
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
      // Solid TINT-blue row with a white capsule "NEXT UP" pill in upper-right.
      // The pill uses TINT text on white background to stay in the blue family.
      <HStack
        alignment="top"
        spacing={8}
        modifiers={[onTapGesture(edit), listRowBackground(TINT)]}
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
    ) : (
      <VStack
        alignment="leading"
        spacing={2}
        modifiers={[
          onTapGesture(edit),
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
                  <HStack spacing={8}>
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
