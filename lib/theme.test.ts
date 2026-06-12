import { describe, it, expect } from 'vitest';
import { EmberPalette, LightTokens, DarkTokens } from '@/constants/theme';

const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

describe('EmberPalette', () => {
  const ACCENT_KEYS = ['coral', 'orange', 'gold', 'olive', 'sage', 'steel', 'rose', 'mauve'] as const;
  const LIGHT_KEYS  = ['coralLight', 'orangeLight', 'goldLight', 'oliveLight', 'sageLight', 'steelLight', 'roseLight', 'mauveLight'] as const;

  it('exports all 8 dark accent colors as valid hex strings', () => {
    for (const key of ACCENT_KEYS) {
      expect(EmberPalette[key], key).toMatch(HEX_RE);
    }
  });

  it('exports all 8 light accent colors as valid hex strings', () => {
    for (const key of LIGHT_KEYS) {
      expect(EmberPalette[key], key).toMatch(HEX_RE);
    }
  });

  it('exports dark and light base bg/fg as valid hex strings', () => {
    expect(EmberPalette.darkBg).toMatch(HEX_RE);
    expect(EmberPalette.darkFg).toMatch(HEX_RE);
    expect(EmberPalette.lightBg).toMatch(HEX_RE);
    expect(EmberPalette.lightFg).toMatch(HEX_RE);
  });

  it('dark accents differ from their light equivalents', () => {
    for (let i = 0; i < ACCENT_KEYS.length; i++) {
      const dark  = EmberPalette[ACCENT_KEYS[i]];
      const light = EmberPalette[LIGHT_KEYS[i]];
      expect(dark, `${ACCENT_KEYS[i]} dark vs light`).not.toBe(light);
    }
  });
});

describe('LightTokens', () => {
  it('has all required fields as valid hex strings', () => {
    const fields = ['background', 'surface', 'backgroundGlass', 'surfaceGlass', 'text', 'textSubtle', 'accent', 'accentFaint', 'onAccent', 'secondaryAction', 'destructive', 'separator'] as const;
    for (const f of fields) {
      expect(LightTokens[f], f).toMatch(HEX_RE);
    }
  });

  it('accent is EmberPalette.coralLight — the interactive colour', () => {
    expect(LightTokens.accent).toBe(EmberPalette.coralLight);
  });

  it('destructive is EmberPalette.roseLight', () => {
    expect(LightTokens.destructive).toBe(EmberPalette.roseLight);
  });

  it('secondaryAction is EmberPalette.steelLight', () => {
    expect(LightTokens.secondaryAction).toBe(EmberPalette.steelLight);
  });

  it('background and surface are different (surface is a lift above bg)', () => {
    expect(LightTokens.background).not.toBe(LightTokens.surface);
  });
});

describe('DarkTokens', () => {
  it('has all required fields as valid hex strings', () => {
    const fields = ['background', 'surface', 'backgroundGlass', 'surfaceGlass', 'text', 'textSubtle', 'accent', 'accentFaint', 'onAccent', 'secondaryAction', 'destructive', 'separator'] as const;
    for (const f of fields) {
      expect(DarkTokens[f], f).toMatch(HEX_RE);
    }
  });

  it('accent is EmberPalette.coral — the interactive colour', () => {
    expect(DarkTokens.accent).toBe(EmberPalette.coral);
  });

  it('destructive is EmberPalette.rose', () => {
    expect(DarkTokens.destructive).toBe(EmberPalette.rose);
  });

  it('secondaryAction is EmberPalette.steel', () => {
    expect(DarkTokens.secondaryAction).toBe(EmberPalette.steel);
  });

  it('background and surface are different', () => {
    expect(DarkTokens.background).not.toBe(DarkTokens.surface);
  });
});
