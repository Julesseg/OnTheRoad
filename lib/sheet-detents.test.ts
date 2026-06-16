import { describe, it, expect } from 'vitest';
import {
  SHEET_DETENTS,
  INITIAL_SHEET_DETENT_INDEX,
  panelFractionForDetent,
} from './sheet-detents';

describe('panelFractionForDetent', () => {
  it('maps the XS, medium, and full detents to their sheet fractions', () => {
    expect(panelFractionForDetent(0)).toBe(0.12);
    expect(panelFractionForDetent(1)).toBe(0.5);
    expect(panelFractionForDetent(2)).toBe(1.0);
  });

  it('opens at the medium detent', () => {
    expect(SHEET_DETENTS[INITIAL_SHEET_DETENT_INDEX]).toBe(0.5);
  });

  it('falls back to the medium fraction for an out-of-range index', () => {
    expect(panelFractionForDetent(-1)).toBe(0.5);
    expect(panelFractionForDetent(3)).toBe(0.5);
  });
});
