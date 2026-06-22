// Shared frame for every Android formSheet/modal body. It collapses the
// per-screen root-View + page-background + safe-area + scroll boilerplate into
// one place so margins, backgrounds, and scrolling stay coherent across surfaces
// (the per-screen drift was the root of the reported margin/background/clip bugs).
//
// Layering rule it enforces (ADR-0015, Material 3): the page paints an explicit
// background (c.background) and the cards passed as children sit one tonal step
// above it (c.surface, via androidMaterial). Never rely on the navigator theme or
// a modal scrim to supply the page colour.
//
// Scroll strategy: an RN <ScrollView> wraps the caller's Compose <Host> (kept at
// matchContents={{ vertical: true }}). RN owns the viewport clamp + scrolling
// while Compose sizes to its intrinsic content height — this sidesteps the
// DateTimePicker "infinity-width" crash that a Compose verticalScroll() would
// risk. The caller supplies the <Host>; this component never owns it.

import type { ReactNode } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors, Spacing } from '@/constants/theme';

export function SheetScaffold({
  header,
  children,
  variant = 'page',
  scroll = true,
  contentBottomInset,
}: {
  /** In-content Material top app bar (a configured <SheetHeader/>). */
  header?: ReactNode;
  /** The screen body — typically a single <Host> of Material cards. */
  children: ReactNode;
  /** 'page' = opaque c.background; 'glass' = c.backgroundGlass for over-map sheets. */
  variant?: 'page' | 'glass';
  /** Wrap children in a ScrollView (default). false → caller owns layout
   *  (e.g. a LazyColumn list that scrolls itself). */
  scroll?: boolean;
  /** Override the scroll content's bottom inset (defaults to nav-bar inset + pageV). */
  contentBottomInset?: number;
}) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const bg = variant === 'glass' ? c.backgroundGlass : c.background;
  const bottomPad = contentBottomInset ?? insets.bottom + Spacing.pageV;

  return (
    <View style={[styles.flex, { backgroundColor: bg, paddingTop: insets.top }]}>
      {header}
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // flexGrow lets short content fill the viewport while tall content scrolls.
  scrollContent: { flexGrow: 1 },
});
