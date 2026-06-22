import type {
  ButtonColors,
  CardColors,
  CheckboxColors,
  IconButtonColors,
  SegmentedButtonColors,
  SwitchColors,
  TextFieldColors,
} from '@expo/ui/jetpack-compose';

import type { ThemeTokens } from './theme';

/**
 * Maps the Ember palette onto the colour props that @expo/ui's Jetpack Compose
 * components expect. Without these, every Material widget (Card, Button,
 * SegmentedButton, TextField, Switch, Checkbox …) falls back to the Material 3
 * *baseline* palette — the cold indigo/lavender that clashes with the warm Ember
 * surfaces the rest of the app draws. The Compose `<Host>` is themed globally via
 * `seedColor` (see `androidHostTheme`), and these per-component objects pin the
 * high-visibility surfaces to the exact Ember tokens.
 *
 * Each value is a plain object derived purely from the active `ThemeTokens`, so
 * call it once per render: `const m = androidMaterial(c)`.
 */
export function androidMaterial(c: ThemeTokens) {
  const transparent = '#00000000';
  return {
    /** Lifted card surface — warm Ember `surface`, not the baseline lavender. */
    card: {
      containerColor: c.surface,
      contentColor: c.text,
    } satisfies CardColors,

    /** Filled, high-emphasis action (coral). Used sparingly for primary CTAs. */
    filledButton: {
      containerColor: c.accent,
      contentColor: c.onAccent,
      disabledContainerColor: c.separator,
      disabledContentColor: c.textSubtle,
    } satisfies ButtonColors,

    /** Tonal action — a faint coral wash; the default for in-form buttons/chips. */
    tonalButton: {
      containerColor: c.accentFaint,
      contentColor: c.accent,
      disabledContainerColor: transparent,
      disabledContentColor: c.textSubtle,
    } satisfies ButtonColors,

    /** Text-only action in the accent colour. */
    textButton: {
      containerColor: transparent,
      contentColor: c.accent,
      disabledContainerColor: transparent,
      disabledContentColor: c.textSubtle,
    } satisfies ButtonColors,

    /** Destructive text action (rose). */
    destructiveButton: {
      containerColor: transparent,
      contentColor: c.destructive,
      disabledContainerColor: transparent,
      disabledContentColor: c.textSubtle,
    } satisfies ButtonColors,

    /** Outlined action in the accent colour. */
    outlinedButton: {
      containerColor: transparent,
      contentColor: c.accent,
      disabledContainerColor: transparent,
      disabledContentColor: c.textSubtle,
    } satisfies ButtonColors,

    /** Single/multi-choice segmented control — coral-selected on a warm card. */
    segmented: {
      activeContainerColor: c.accentFaint,
      activeContentColor: c.accent,
      activeBorderColor: c.accent,
      inactiveContainerColor: transparent,
      inactiveContentColor: c.text,
      inactiveBorderColor: c.separator,
      disabledActiveBorderColor: c.separator,
      disabledInactiveBorderColor: c.separator,
      disabledActiveContentColor: c.textSubtle,
      disabledInactiveContentColor: c.textSubtle,
    } satisfies SegmentedButtonColors,

    /** Switch — coral track when on, neutral when off. */
    switch: {
      checkedThumbColor: c.onAccent,
      checkedTrackColor: c.accent,
      checkedBorderColor: c.accent,
      uncheckedThumbColor: c.textSubtle,
      uncheckedTrackColor: transparent,
      uncheckedBorderColor: c.separator,
    } satisfies SwitchColors,

    /** Checkbox — coral fill, onAccent checkmark. */
    checkbox: {
      checkedColor: c.accent,
      uncheckedColor: c.textSubtle,
      checkmarkColor: c.onAccent,
      disabledCheckedColor: c.separator,
      disabledUncheckedColor: c.separator,
    } satisfies CheckboxColors,

    /**
     * Text fields blend into the card (transparent container) with a coral focus
     * indicator/label/cursor — the Material underlined-field look, on Ember.
     */
    textField: {
      focusedTextColor: c.text,
      unfocusedTextColor: c.text,
      errorTextColor: c.destructive,
      focusedContainerColor: transparent,
      unfocusedContainerColor: transparent,
      disabledContainerColor: transparent,
      errorContainerColor: transparent,
      cursorColor: c.accent,
      errorCursorColor: c.destructive,
      focusedIndicatorColor: c.accent,
      unfocusedIndicatorColor: c.separator,
      errorIndicatorColor: c.destructive,
      focusedLabelColor: c.accent,
      unfocusedLabelColor: c.textSubtle,
      errorLabelColor: c.destructive,
      focusedPlaceholderColor: c.textSubtle,
      unfocusedPlaceholderColor: c.textSubtle,
    } satisfies TextFieldColors,

    /** Icon button content in the accent colour. */
    iconButton: {
      containerColor: transparent,
      contentColor: c.accent,
      disabledContentColor: c.textSubtle,
    } satisfies IconButtonColors,
  };
}

/**
 * Themes a Compose `<Host>` so its whole subtree derives a coherent Material 3
 * palette from the Ember accent (`SchemeTonalSpot`, the Material You algorithm)
 * instead of the baseline indigo. Spread onto every `<Host>`:
 * `<Host {...androidHostTheme(c, scheme)} …>`. Per-component `androidMaterial`
 * colours still win where set; this fixes the long tail (ripples, cursors,
 * unstyled defaults).
 */
export function androidHostTheme(c: ThemeTokens, scheme: 'light' | 'dark') {
  return { seedColor: c.accent, colorScheme: scheme } as const;
}
