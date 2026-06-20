import { useMemo, type ReactNode } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { Host, Column, Card, Row, Text, IconButton, Surface, Checkbox, Button } from '@expo/ui/jetpack-compose';
import { padding } from '@expo/ui/jetpack-compose/modifiers';
import type { Trip, Item } from '@/lib/schema';
import { useTripStore } from '@/lib/store';
import { useThemeColors } from '@/constants/theme';
import { formatDayLabel } from '@/lib/date-utils';
import { formatItem } from '@/lib/item-display';
import { itemIdentity } from '@/lib/item-identity';
import { checklistProgress } from '@/lib/checklist';
import { resolveNextUp } from '@/lib/next-up';
import { localDateString } from '@/lib/today';
import { openInMaps, type MapsTarget } from '@/lib/maps';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';

const WHITE = '#ffffff';

// The map destination an item exposes, if any — coordinates and/or an address.
// Any category can carry a location sub-object. Mirrors itinerary-panel.tsx (iOS).
function mapsTargetForItem(item: Item): MapsTarget | null {
  if (!item.location) return null;
  const { lat, lng, address } = item.location;
  const coords = lat != null && lng != null ? { lat, lng } : undefined;
  if (!coords && !address) return null;
  return { coords, address };
}

/**
 * Android (Material 3) twin of itinerary-panel.tsx (ADR-0015). The SwiftUI grouped
 * `List` of `Section`s becomes a `Column` of Material `Card`s — one Card per Day,
 * with a header Row (Day N + date + an add IconButton) followed by item rows. Each
 * row is a tappable `Surface` carrying the category icon (via the shared platform
 * `IconSymbol` resolver), the type label + checklist progress, the name and the
 * time/notes lines, plus the next-up highlight. Checklist entries are Material
 * `Checkbox`es that write straight through to storage. Per-row Navigate / Delete
 * actions replace the iOS swipe actions. All shared logic (props, handlers, lib
 * calls) is identical to the iOS base — only the @expo/ui render tree diverges.
 *
 * `titleRow` is rendered as the Column's leading child; `scrollModifier` has no
 * Compose equivalent here and is accepted for prop-parity only.
 */
export function ItineraryPanel({
  trip,
  days: daysProp,
  now = new Date(),
  titleRow,
  onDayPress,
}: {
  trip: Trip;
  days?: import('@/lib/schema').Day[];
  now?: Date;
  titleRow?: ReactNode;
  scrollModifier?: import('@expo/ui/swift-ui/modifiers').BuiltInModifier | null;
  onDayPress?: (date: string) => void;
}) {
  const c = useThemeColors();
  const subtext = c.textSubtle;

  const deleteItem = useTripStore((s) => s.deleteItem);
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
  // editor opens on its default ("activity").
  function addItemToDay(dayId: string) {
    router.push({
      pathname: '/trip/[id]/item',
      params: { id: trip.id, dayId },
    });
  }

  function renderItem(
    dayId: string,
    item: Item,
    { isNextUp }: { isNextUp: boolean },
  ) {
    const { typeLabel, title, lines } = formatItem(item);
    const identity = itemIdentity(item.category);
    const edit = () => openItemEditor(dayId, item.id);
    const remove = () => confirmDelete(dayId, item);
    const mapsTarget = mapsTargetForItem(item);

    const openMaps = mapsTarget
      ? () => openInMaps(mapsTarget, { app: preferredMapsApp }).catch(() => {})
      : null;

    const checklist = item.checklist ?? [];
    const onColor = isNextUp ? WHITE : subtext;
    const iconColor = isNextUp ? WHITE : identity.accent;

    return (
      <Surface key={item.id} onClick={edit}>
        <Column modifiers={[padding({ all: 8 })]}>
          <Row>
            <IconSymbol name={identity.symbol as IconSymbolName} color={iconColor} size={12} />
            <Text color={onColor}>{typeLabel.toUpperCase()}</Text>
            {checklist.length > 0 ? (
              <Row>
                <IconSymbol name="checklist" color={onColor} size={10} />
                <Text color={onColor}>{checklistProgress(checklist)}</Text>
              </Row>
            ) : null}
            {mapsTarget ? (
              <IconSymbol name="map" color={onColor} size={13} />
            ) : null}
            {isNextUp ? <Text color={WHITE}>NEXT UP</Text> : null}
          </Row>
          <Text color={isNextUp ? WHITE : c.text}>{title}</Text>
          {lines.map((line, i) => (
            <Text key={i} color={onColor}>
              {line}
            </Text>
          ))}
        </Column>
        {checklist.map((entry) => (
          <Row key={entry.id}>
            <Checkbox
              value={entry.checked}
              onCheckedChange={() => toggleChecklistEntry(trip.id, dayId, item.id, entry.id)}
            />
            <Text color={isNextUp ? WHITE : c.text}>{entry.label}</Text>
          </Row>
        ))}
        {openMaps ? (
          <Button onClick={openMaps}>
            <Text>Navigate</Text>
          </Button>
        ) : null}
        <Button onClick={remove}>
          <Text>Delete</Text>
        </Button>
      </Surface>
    );
  }

  return (
    <View style={styles.container}>
      <Host style={styles.host} matchContents>
        <Column modifiers={[padding({ horizontal: 16, vertical: 12 })]}>
          {titleRow}
          {days.map((day) => (
            <Card key={day.id} modifiers={[padding({ all: 8 })]}>
              <Column>
                <Row>
                  <Surface onClick={onDayPress ? () => onDayPress(day.date) : undefined}>
                    <Row>
                      <Text color={day.date === today ? c.accent : subtext}>
                        {`Day ${dayPosition.get(day.id) ?? '?'}`}
                      </Text>
                      <Text color={subtext}>{formatDayLabel(day.date)}</Text>
                    </Row>
                  </Surface>
                  <IconButton onClick={() => addItemToDay(day.id)}>
                    <IconSymbol name="plus" color={c.accent} size={20} />
                  </IconButton>
                </Row>
                {day.items.map((item) =>
                  renderItem(day.id, item, {
                    isNextUp: nextUp?.dayId === day.id && nextUp?.itemId === item.id,
                  }),
                )}
              </Column>
            </Card>
          ))}
        </Column>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  host: { flex: 1 },
});
