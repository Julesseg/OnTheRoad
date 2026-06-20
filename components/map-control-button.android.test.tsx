import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MapControlButton } from '@/components/map-control-button.android';

// Android (Material surface) variant of the map control. Same press contract as
// iOS; the glass is a Material elevated surface and the icon renders via the
// globally-stubbed MaterialIcons.
describe('MapControlButton (Android)', () => {
  it('fires onPress when tapped, and exposes its accessibility label', () => {
    const onPress = vi.fn();
    render(
      <MapControlButton
        name="scope"
        accessibilityLabel="Recenter map"
        color="#fff"
        onPress={onPress}
      />,
    );
    const button = screen.getByLabelText('Recenter map');
    expect(button).toBeInTheDocument();
    act(() => fireEvent.click(button));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders a Material icon for the given symbol', () => {
    render(
      <MapControlButton
        name="location.fill"
        accessibilityLabel="Center on me"
        color="#fff"
        onPress={() => {}}
      />,
    );
    // IconSymbol → MaterialIcons stub resolves the SF name to a Material glyph.
    expect(screen.getByTestId('material-icon').getAttribute('data-icon')).toBe('near-me');
  });
});
