import { describe, it, expect } from 'vitest';

// Vitest resolves the non-platform base (icon-symbol.tsx) — the Android/Material
// fallback — so these tests pin the SF-Symbol → Material-Icon abstraction that lets
// the same IconSymbol name render on both platforms (ADR-0015). androidIconName is
// the single resolver; every SF name the app passes to IconSymbol must resolve to a
// real MaterialIcons glyph, or the icon renders blank on Android.
import { androidIconName } from './icon-mapping';
import { ITEM_IDENTITY } from '@/lib/item-identity';

const glyphs = require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialIcons.json');

// Every SF symbol passed to IconSymbol across the shared components (pin-info-card,
// glass-button, map-control-button, item-editor category icon).
const APP_SF_SYMBOLS = [
  // map controls
  'scope',
  'location.fill',
  // pin info card
  'checklist',
  'checkmark.circle.fill',
  'circle',
  'map',
  // glass buttons
  'plus',
  'xmark',
  'checkmark',
  'doc.on.doc',
  'doc.on.clipboard',
  'folder',
  'gearshape',
  'line.3.horizontal.decrease',
  'list.bullet',
  'square.and.arrow.down',
  'chevron.backward',
];

describe('androidIconName', () => {
  it('resolves every app SF symbol to a real MaterialIcons glyph', () => {
    for (const sf of APP_SF_SYMBOLS) {
      const material = androidIconName(sf as Parameters<typeof androidIconName>[0]);
      expect(material, `no Material mapping for "${sf}"`).toBeTruthy();
      expect(material in glyphs, `"${material}" is not a MaterialIcons glyph`).toBe(true);
    }
  });

  it('resolves each category SF symbol via item-identity, with no drift', () => {
    for (const identity of Object.values(ITEM_IDENTITY)) {
      expect(androidIconName(identity.symbol as Parameters<typeof androidIconName>[0])).toBe(
        identity.materialSymbol,
      );
    }
  });
});
