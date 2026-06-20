import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressiveBlurView } from '@/components/progressive-blur.android';

// expo-linear-gradient pulls a native module; stub it to an inspectable element so
// the Material scrim variant renders under jsdom.
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ colors }: { colors: string[] }) =>
    React.createElement('div', { 'data-testid': 'scrim', 'data-colors': colors.join(',') }),
}));

describe('ProgressiveBlurView (Android)', () => {
  it('renders a background-coloured scrim that fades to transparent (no native blur)', () => {
    const { getByTestId } = render(<ProgressiveBlurView intensity={20} layers={10} />);
    const colors = getByTestId('scrim').getAttribute('data-colors')!.split(',');
    // Three stops, the last fully transparent (alpha 00).
    expect(colors).toHaveLength(3);
    expect(colors[2].toLowerCase()).toMatch(/00$/);
  });

  it('scales the scrim opacity with intensity', () => {
    const { getByTestId, rerender } = render(<ProgressiveBlurView intensity={0} />);
    const light = getByTestId('scrim').getAttribute('data-colors')!.split(',')[0];
    rerender(<ProgressiveBlurView intensity={100} />);
    const heavy = getByTestId('scrim').getAttribute('data-colors')!.split(',')[0];
    expect(light).not.toBe(heavy);
  });
});
