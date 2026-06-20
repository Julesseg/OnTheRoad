import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { GlassButton } from '@/components/glass-button.android';

// Android (Material tonal pill) variant. Same label + icon + press contract as
// the iOS glass pill.
describe('GlassButton (Android)', () => {
  it('renders its label and fires onPress', () => {
    const onPress = vi.fn();
    render(<GlassButton label="Copy schema" icon="doc.on.doc" accent="#b84c30" onPress={onPress} />);
    const button = screen.getByRole('button', { name: /copy schema/i });
    act(() => fireEvent.click(button));
    expect(onPress).toHaveBeenCalled();
  });

  it('renders the Material glyph for its icon', () => {
    render(<GlassButton label="New trip" icon="plus" accent="#b84c30" onPress={() => {}} />);
    expect(screen.getByTestId('material-icon').getAttribute('data-icon')).toBe('add');
  });
});
