// In-content Material top-app-bar for formSheet screens. On Android,
// react-native-screens never builds the native header/toolbar for a `formSheet`
// presentation (ScreenStackFragment.onCreateView gates the AppBarLayout on
// `!usesFormSheetPresentation()`), so a screen's `Stack.Toolbar` actions and
// `Stack.Title` are silently dropped. These components reproduce that chrome
// inside the sheet body: a leading action group, a leading title, and a trailing
// action group — mirroring the iOS Stack.Toolbar layout (ADR-0015). iOS keeps the
// native toolbar; only the Android (and shared, platform-guarded) screens use this.

import { useState, type ReactNode } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { IconSymbol, type IconSymbolName } from './icon-symbol';
import { useThemeColors } from '@/constants/theme';

// Standard Material top-app-bar height; the sheets already reserve a comparable
// band at the top of their body (their old NAV_BAR_HEIGHT).
export const SHEET_HEADER_HEIGHT = 56;

export function SheetHeader({
  left,
  title,
  titleNode,
  right,
  style,
}: {
  left?: ReactNode;
  title?: string;
  // Custom title content (e.g. an animated cross-fading inline title). Takes
  // precedence over `title`; both flex to fill the space between the groups.
  titleNode?: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useThemeColors();
  return (
    <View style={[styles.bar, style]}>
      <View style={styles.group}>{left}</View>
      {titleNode !== undefined ? (
        <View style={styles.title}>{titleNode}</View>
      ) : (
        <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>
          {title ?? ''}
        </Text>
      )}
      <View style={[styles.group, styles.groupEnd]}>{right}</View>
    </View>
  );
}

export function SheetHeaderIconButton({
  icon,
  accent,
  onPress,
  accessibilityLabel,
  disabled = false,
  selected = false,
  hidden = false,
  prominent = false,
}: {
  icon: IconSymbolName;
  accent: string;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  selected?: boolean;
  hidden?: boolean;
  // Filled accent circle with the glyph in onAccent — the emphasised primary
  // action (e.g. Save), matching the iOS `variant="prominent"` toolbar button.
  prominent?: boolean;
}) {
  const c = useThemeColors();
  if (hidden) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        selected && { backgroundColor: c.accentFaint },
        prominent && { backgroundColor: accent },
        { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
      ]}
    >
      <IconSymbol name={icon} size={24} color={prominent ? c.onAccent : accent} />
    </Pressable>
  );
}

export function SheetHeaderTextButton({
  label,
  accent,
  onPress,
  prominent = false,
  disabled = false,
}: {
  label: string;
  accent: string;
  onPress: () => void;
  prominent?: boolean;
  disabled?: boolean;
}) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.textButton,
        prominent && { backgroundColor: accent },
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text
        style={[
          styles.textButtonLabel,
          { color: prominent ? c.onAccent : accent, fontWeight: prominent ? '700' : '600' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// A trailing overflow/add action that opens a Material dropdown of actions —
// the in-content equivalent of Stack.Toolbar.Menu (also unavailable on Android
// formSheets). The menu is a lightweight Modal popover anchored top-right.
export function SheetHeaderMenu({
  icon,
  accent,
  accessibilityLabel,
  actions,
}: {
  icon: IconSymbolName;
  accent: string;
  accessibilityLabel: string;
  actions: { label: string; icon?: IconSymbolName; onPress: () => void }[];
}) {
  const c = useThemeColors();
  const [open, setOpen] = useState(false);
  return (
    <>
      <SheetHeaderIconButton
        icon={icon}
        accent={accent}
        accessibilityLabel={accessibilityLabel}
        onPress={() => setOpen(true)}
      />
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.menuScrim} onPress={() => setOpen(false)}>
          {/* Absorb taps that land on the card's own padding (between items) so they
              don't fall through to the scrim and dismiss the menu — Material dropdowns
              only dismiss on an outside tap. */}
          <Pressable style={[styles.menuCard, { backgroundColor: c.surface }]} onPress={() => {}}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                accessibilityRole="menuitem"
                accessibilityLabel={a.label}
                onPress={() => {
                  setOpen(false);
                  a.onPress();
                }}
                style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.6 : 1 }]}
              >
                {a.icon ? <IconSymbol name={a.icon} size={20} color={c.text} /> : null}
                <Text style={[styles.menuItemLabel, { color: c.text }]}>{a.label}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: SHEET_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    // 12 (not 8) so the 40dp icon-button touch targets land their glyph edge at
    // ~16dp — flush with the 16dp (Spacing.pageH) card gutter below the header.
    paddingHorizontal: 12,
    gap: 4,
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  groupEnd: { justifyContent: 'flex-end' },
  title: { flex: 1, fontSize: 18, fontWeight: '600', paddingHorizontal: 4 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButtonLabel: { fontSize: 16 },
  // Dropdown menu (SheetHeaderMenu): a full-screen scrim that dismisses on tap,
  // with the menu card pinned to the top-right under the trigger.
  menuScrim: { flex: 1, paddingTop: SHEET_HEADER_HEIGHT, paddingRight: 12, alignItems: 'flex-end' },
  menuCard: {
    minWidth: 180,
    borderRadius: 12,
    paddingVertical: 6,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemLabel: { fontSize: 16 },
});
