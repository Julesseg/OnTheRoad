import { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Alert, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Host, Column, Card, Row, Text, Surface, Checkbox, TextButton } from '@expo/ui/jetpack-compose';
import { padding, paddingAll, weight, fillMaxWidth, clip, Shapes } from '@expo/ui/jetpack-compose/modifiers';
import type { Trip, Item } from '@/lib/schema';
import { useTripStore } from '@/lib/store';
import { useThemeColors, Spacing } from '@/constants/theme';
import { androidMaterial, androidHostTheme } from '@/constants/android-material';
import { formatDayLabel } from '@/lib/date-utils';
import { formatItem } from '@/lib/item-display';
import { itemIdentity } from '@/lib/item-identity';
import { checklistProgress } from '@/lib/checklist';
import { resolveNextUp } from '@/lib/next-up';
import { localDateString } from '@/lib/today';
import { openInMaps, type MapsTarget } from '@/lib/maps';

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
  const m = androidMaterial(c);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const insets = useSafeAreaInsets();

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
    // Next-up rows fill with the coral accent; everything on them uses onAccent
    // (the token paired for contrast). Plain rows blend into the warm Card.
    const onColor = isNextUp ? c.onAccent : subtext;
    const titleColor = isNextUp ? c.onAccent : c.text;
    const iconColor = isNextUp ? c.onAccent : identity.accent;
    const navColor = { containerColor: '#00000000', contentColor: isNextUp ? c.onAccent : c.accent };
    const deleteColor = { containerColor: '#00000000', contentColor: isNextUp ? c.onAccent : c.destructive };
    const checkboxColor = isNextUp
      ? { checkedColor: c.onAccent, uncheckedColor: c.onAccent, checkmarkColor: c.accent }
      : m.checkbox;

    // Everything lives in ONE full-width Column so the Surface has a single child:
    // a Surface with multiple direct children lays them out stacked/overlapping with
    // no width, which collapsed the row (the type label wrapped one letter per line
    // and only the action buttons showed). The Column fills the card width so the
    // type Row reads horizontally and the actions sit full-width beneath the text.
    return (
      <Surface
        key={item.id}
        onClick={edit}
        color={isNextUp ? c.accent : '#00000000'}
        modifiers={isNextUp ? [fillMaxWidth(), clip(Shapes.RoundedCorner(14))] : [fillMaxWidth()]}
      >
        <Column modifiers={[fillMaxWidth(), paddingAll(Spacing.itemPad)]} verticalArrangement={{ spacedBy: 4 }}>
          {/* Meta line is pure Compose Text (no embedded RN IconSymbol): an
              IconSymbol inside a Compose Row grabs the row width and collapses the
              type label to one letter per line. The category meaning the icon carried
              is preserved by tinting the type label with the category accent, and the
              checklist/map cues are short text tokens. */}
          <Row horizontalArrangement={{ spacedBy: Spacing.iconGap }} verticalAlignment="center">
            <Text color={iconColor} style={{ typography: 'labelMedium' }}>{typeLabel.toUpperCase()}</Text>
            {checklist.length > 0 ? (
              <Text color={onColor} style={{ typography: 'labelSmall' }}>{`☑ ${checklistProgress(checklist)}`}</Text>
            ) : null}
            {mapsTarget ? (
              <Text color={onColor} style={{ typography: 'labelSmall' }}>· Map</Text>
            ) : null}
            {isNextUp ? <Text color={c.onAccent} style={{ typography: 'labelMedium' }}>NEXT UP</Text> : null}
          </Row>
          <Text color={titleColor} style={{ typography: 'titleMedium' }}>{title}</Text>
          {lines.map((line, i) => (
            <Text key={i} color={onColor} style={{ typography: 'bodyMedium' }}>
              {line}
            </Text>
          ))}
          {checklist.map((entry) => (
            <Row key={entry.id} horizontalArrangement={{ spacedBy: 6 }} verticalAlignment="center">
              <Checkbox
                value={entry.checked}
                colors={checkboxColor}
                onCheckedChange={() => toggleChecklistEntry(trip.id, dayId, item.id, entry.id)}
              />
              <Text color={titleColor} style={{ typography: 'bodyMedium' }}>{entry.label}</Text>
            </Row>
          ))}
          <Row horizontalArrangement={{ spacedBy: 4 }} verticalAlignment="center">
            {openMaps ? (
              <TextButton onClick={openMaps} colors={navColor}>
                <Text>Navigate</Text>
              </TextButton>
            ) : null}
            <TextButton onClick={remove} colors={deleteColor}>
              <Text>Delete</Text>
            </TextButton>
          </Row>
        </Column>
      </Surface>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.pageV }}
      showsVerticalScrollIndicator={false}
    >
      {/* vertical-only matchContents: full `matchContents` wraps width too, which
          shrinks every day Card to its content and left-packs the list. Matching
          height only lets width fill the sheet (MATCH_PARENT) so cards span it. The
          RN ScrollView scrolls a long itinerary within the sheet. */}
      <Host matchContents={{ vertical: true }} {...androidHostTheme(c, scheme)}>
        <Column modifiers={[padding(Spacing.pageH, Spacing.pageV, Spacing.pageH, 0)]} verticalArrangement={{ spacedBy: Spacing.sectionGap }}>
          {titleRow}
          {days.map((day) => (
            <Card key={day.id} modifiers={[fillMaxWidth(), paddingAll(Spacing.cardPad)]} colors={m.card}>
              <Column verticalArrangement={{ spacedBy: Spacing.rowGap }}>
                <Row modifiers={[fillMaxWidth()]} verticalAlignment="center">
                  {/* The day label takes the flexible weight so the add (+) button is
                      pushed to the trailing edge — a Material list-header layout. The
                      Surface is transparent so it blends into the Card instead of
                      drawing its own grey box. */}
                  <Surface
                    color="#00000000"
                    modifiers={[weight(1)]}
                    onClick={onDayPress ? () => onDayPress(day.date) : undefined}
                  >
                    <Row horizontalArrangement={{ spacedBy: 8 }} verticalAlignment="center">
                      <Text
                        color={day.date === today ? c.accent : c.text}
                        style={{ typography: 'titleMedium' }}
                      >
                        {`Day ${dayPosition.get(day.id) ?? '?'}`}
                      </Text>
                      <Text color={subtext} style={{ typography: 'bodyMedium' }}>
                        {formatDayLabel(day.date)}
                      </Text>
                    </Row>
                  </Surface>
                  {/* Plain-text "+ Add" instead of an IconButton wrapping an embedded
                      IconSymbol (which renders as a tiny/broken glyph in Compose). */}
                  <TextButton onClick={() => addItemToDay(day.id)} colors={m.textButton}>
                    <Text>+ Add</Text>
                  </TextButton>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
