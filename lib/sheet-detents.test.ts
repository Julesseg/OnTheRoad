import { describe, it, expect } from 'vitest';
import {
  SHEET_DETENTS,
  INITIAL_SHEET_DETENT_INDEX,
  MIN_SHEET_DETENT_INDEX,
  panelFractionForDetent,
} from './sheet-detents';

describe('panelFractionForDetent', () => {
  it('frames into the area the XS and medium sheets leave visible', () => {
    expect(panelFractionForDetent(0)).toBe(0.1);
    expect(panelFractionForDetent(1)).toBe(0.5);
  });

  it('centres the map (no shift) at the full detent, where no map is visible', () => {
    expect(panelFractionForDetent(2)).toBe(0);
  });

  it('opens at the medium detent and peeks at the XS detent', () => {
    expect(SHEET_DETENTS[INITIAL_SHEET_DETENT_INDEX]).toBe(0.5);
    expect(SHEET_DETENTS[MIN_SHEET_DETENT_INDEX]).toBe(0.1);
  });

  it('falls back to the medium fraction for an out-of-range index', () => {
    expect(panelFractionForDetent(-1)).toBe(0.5);
    expect(panelFractionForDetent(3)).toBe(0.5);
  });
});
