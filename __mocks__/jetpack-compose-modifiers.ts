// Test stub for `@expo/ui/jetpack-compose/modifiers`, aliased in vitest.config.ts.
// Compose modifiers are visual-only; in jsdom they carry no behaviour, so every
// modifier resolves to a no-op config object. Mirrors the real module's named
// exports so the Android variants can import any modifier without crashing the
// test render (which ignores modifiers entirely).
const noop = (..._args: unknown[]) => ({});

export const Shapes = {} as Record<string, unknown>;
export const align = noop;
export const alpha = noop;
export const animateContentSize = noop;
export const background = noop;
export const blur = noop;
export const border = noop;
export const clickable = noop;
export const clip = noop;
export const combinedClickable = noop;
export const defaultMinSize = noop;
export const fillMaxHeight = noop;
export const fillMaxSize = noop;
export const fillMaxWidth = noop;
export const graphicsLayer = noop;
export const height = noop;
export const horizontalScroll = noop;
export const imePadding = noop;
export const matchParentSize = noop;
export const menuAnchor = noop;
export const offset = noop;
export const onSizeChanged = noop;
export const onVisibilityChanged = noop;
export const padding = noop;
export const paddingAll = noop;
export const rotate = noop;
export const selectable = noop;
export const selectableGroup = noop;
export const semantics = noop;
export const shadow = noop;
export const size = noop;
export const testID = noop;
export const toggleable = noop;
export const verticalScroll = noop;
export const weight = noop;
export const width = noop;
export const wrapContentHeight = noop;
export const wrapContentWidth = noop;
export const zIndex = noop;
