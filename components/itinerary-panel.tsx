import { useMemo, useState, type ReactElement } from 'react';
import {
  View,
  StyleSheet,
  ActionSheetIOS,
  Alert,
  useColorScheme,
  type LayoutChangeEvent,
} from 'react-native';
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
  ContextMenu,
  useNativeState,
} from '@expo/ui/swift-ui';
import {
  listStyle,
  font,
  foregroundStyle,
  listRowBackground,
  listRowSeparator,
  listSectionSpacing,
  listSectionMargins,
  frame,
  onTapGesture,
  scrollPosition,
  id,
} from '@expo/ui/swift-ui/modifiers';

import type { Trip, Item } from '@/lib/schema';
import type { ItemType } from '@/lib/item-form';
import { useTripStore } from '@/lib/store';
import { formatDayLabel } from '@/lib/date-utils';
import { formatItem } from '@/lib/item-display';
import { resolveNextUp } from '@/lib/next-up';
import { localDateString } from '@/lib/today';
import { openInMaps, MAPS_APP_LABELS, type MapsTarget } from '@/lib/maps';
import { ProgressiveBlurView } from './progressive-blur';

const TINT = '#007AFF';
const WHITE = '#ffffff';
const TRANSPARENT = '#00000000';

// Item types offered when adding to a day, paired with their action-sheet labels.
const ADD_ITEM_OPTIONS: { type: ItemType; label: string }[] = [
  { type: 'location', label: 'Location' },
  { type: 'accommodation', label: 'Accommodation' },
  { type: 'activity', label: 'Activity' },
  { type: 'note', label: 'Note' },
];

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
 * The itinerary rendered with a native SwiftUI `List`: an optional Next-up card,
 * then one `Section` per Day (header + its Item rows in stored order). Sections
 * give the system grouped-list separation between Days. Each row carries native
 * swipe actions (leading Edit, trailing Delete) and a long-press context menu;
 * tapping the Next-up card scrolls the List to that Day via `scrollPosition`.
 *
 * The trip `header` floats over the top of the List behind a progressive blur, so
 * Day rows scroll up underneath it and blur progressively. A transparent spacer
 * row the height of the header keeps the first rows clear of it at rest.
 */
export function ItineraryPanel({
  trip,
  now = new Date(),
  header,
}: {
  trip: Trip;
  now?: Date;
  header?: ReactElement | null;
}) {
  const colorScheme = useColorScheme();
  const subtext = colorScheme === 'dark' ? '#9a9a9a' : '#888';

  // Measured height of the floating header, used to inset the list's first rows.
  const [headerHeight, setHeaderHeight] = useState(0);
  const onHeaderLayout = (e: LayoutChangeEvent) => setHeaderHeight(e.nativeEvent.layout.height);

  const deleteItem = useTripStore((s) => s.deleteItem);
  const moveItem = useTripStore((s) => s.moveItem);
  const preferredMapsApp = useTripStore((s) => s.preferredMapsApp);

  const today = localDateString(now);
  const days = useMemo(
    () => [...trip.days].sort((a, b) => a.date.localeCompare(b.date)),
    [trip.days],
  );
  const nextUp = useMemo(() => resolveNextUp(trip, now), [trip, now]);

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

  function showMoveToDaySheet(fromDayId: string, itemId: string) {
    const others = days.filter((d) => d.id !== fromDayId);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Move to day',
        options: [...others.map((d) => `Day ${days.indexOf(d) + 1}`), 'Cancel'],
        cancelButtonIndex: others.length,
      },
      (index) => {
        const target = others[index];
        if (target) moveItem(trip.id, fromDayId, target.id, itemId);
      },
    );
  }

  // Pick an item type for the day, then open the editor to create it.
  function addItemToDay(dayId: string, type: ItemType) {
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
      // Swipe leading→Edit. Swipe trailing→Open in Maps (full swipe) when the item has a
      // destination, with Delete as the secondary button; otherwise trailing is just Delete.
      // Long-press opens the context menu.
      <SwipeActions key={item.id}>
        <ContextMenu>
          <ContextMenu.Items>
            <Button systemImage="pencil" label="Edit" onPress={edit} />
            {days.length > 1 ? (
              <Button
                systemImage="calendar"
                label="Move to day"
                onPress={() => showMoveToDaySheet(dayId, item.id)}
              />
            ) : null}
            <Button systemImage="trash" role="destructive" label="Delete" onPress={remove} />
          </ContextMenu.Items>
          <ContextMenu.Trigger>
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
          </ContextMenu.Trigger>
        </ContextMenu>

        <SwipeActions.Actions edge="leading">
          <Button systemImage="pencil" label="Edit" onPress={edit} />
        </SwipeActions.Actions>
        <SwipeActions.Actions edge="trailing">
          {openMaps ? (
            <Button
              systemImage="map"
              label={`Open in ${MAPS_APP_LABELS[preferredMapsApp]}`}
              onPress={openMaps}
            />
          ) : null}
          <Button systemImage="trash" role="destructive" label="Delete" onPress={remove} />
        </SwipeActions.Actions>
      </SwipeActions>
    );
  }

  return (
    <View style={styles.container}>
      <Host style={styles.host} colorScheme={colorScheme === 'dark' ? 'dark' : 'light'}>
        <List
          modifiers={[listStyle('insetGrouped'), scrollPosition(scrollTarget, { anchor: 'top' })]}
        >
          {/* Transparent spacer so the first rows clear the floating header at rest.
              Trimmed because the grouped list already reserves some top inset. */}
          {headerHeight > 0 ? (
            <Section modifiers={[listSectionSpacing(0)]}>
              <VStack
                modifiers={[
                  frame({ height: Math.max(0, headerHeight - 64) }),
                  listRowBackground(TRANSPARENT),
                  listRowSeparator('hidden'),
                ]}
              >
                <Spacer />
              </VStack>
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
                    <Menu label={<Image systemName="plus" size={20} />}>
                      {ADD_ITEM_OPTIONS.map((o) => (
                        <Button
                          key={o.type}
                          label={o.label}
                          onPress={() => addItemToDay(day.id, o.type)}
                        />
                      ))}
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
              {day.items.map((item) => renderItem(day.id, item))}
            </Section>
          ))}
        </List>
      </Host>

      {/* Floating header: progressive blur behind the trip header; rows scroll under it. */}
      <View style={styles.headerOverlay} onLayout={onHeaderLayout} pointerEvents="box-none">
        <ProgressiveBlurView intensity={20} layers={10} />
        {header}
      </View>
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
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
});
