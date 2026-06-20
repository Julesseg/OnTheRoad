// The pure SF-Symbol → Material-Icon resolver, kept separate from the IconSymbol
// component so it can be imported (and unit-tested) without pulling in the
// @expo/vector-icons render code. The same IconSymbol `name` (an SF Symbol)
// resolves to a Material glyph on Android via this mapping (ADR-0015).

import type { ComponentProps } from 'react';
import type MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { ITEM_IDENTITY } from '@/lib/item-identity';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

// Per-category icons come straight from item-identity, so the SF → Material pair
// has a single source of truth and can never drift from the category definitions.
const CATEGORY_MAPPING = Object.fromEntries(
  Object.values(ITEM_IDENTITY).map((i) => [i.symbol, i.materialSymbol]),
) as Record<string, MaterialIconName>;

// Every other SF Symbol the app passes to IconSymbol, mapped to its closest
// Material Icons name. See SF Symbols app and https://icons.expo.fyi.
const FIXED_MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.backward': 'chevron-left',
  scope: 'my-location',
  'location.fill': 'near-me',
  checklist: 'checklist',
  'checkmark.circle.fill': 'check-circle',
  circle: 'radio-button-unchecked',
  map: 'map',
  plus: 'add',
  xmark: 'close',
  checkmark: 'check',
  'doc.on.doc': 'content-copy',
  'doc.on.clipboard': 'content-paste',
  folder: 'folder',
  gearshape: 'settings',
  'line.3.horizontal.decrease': 'filter-list',
  'list.bullet': 'format-list-bulleted',
  'square.and.arrow.down': 'download',
} satisfies Record<string, MaterialIconName>;

const MAPPING = { ...FIXED_MAPPING, ...CATEGORY_MAPPING } as Record<string, MaterialIconName>;

export type IconSymbolName = keyof typeof FIXED_MAPPING | keyof typeof CATEGORY_MAPPING;

/** Resolves an SF Symbol name to its Material Icons glyph (Android render path). */
export function androidIconName(name: IconSymbolName): MaterialIconName {
  return MAPPING[name];
}
