import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ItemTypePicker } from '@/components/item-type-picker';

// expo-glass-effect / expo-symbols are native; render them as plain passthroughs
// so the card grid and its labels stay assertable under jsdom.
vi.mock('expo-glass-effect', async () => {
  const React = await import('react');
  return {
    GlassView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});
vi.mock('expo-symbols', () => ({ SymbolView: () => null }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ItemTypePicker', () => {
  it('shows a card with the warm label for each item type', () => {
    render(<ItemTypePicker dayNumber={1} onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Place')).toBeInTheDocument();
    expect(screen.getByText('Stay')).toBeInTheDocument();
    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getByText('Note')).toBeInTheDocument();
  });

  it('titles the sheet for the day being added to', () => {
    render(<ItemTypePicker dayNumber={3} onSelect={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Add to Day 3')).toBeInTheDocument();
  });

  it('selecting a card reports the canonical type, not the warm label', () => {
    const onSelect = vi.fn();
    render(<ItemTypePicker dayNumber={1} onSelect={onSelect} onClose={() => {}} />);
    fireEvent.click(screen.getByText('Stay'));
    expect(onSelect).toHaveBeenCalledWith('accommodation');
  });

  it('dismisses via the backdrop', () => {
    const onClose = vi.fn();
    render(<ItemTypePicker dayNumber={1} onSelect={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(onClose).toHaveBeenCalled();
  });
});
