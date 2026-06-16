import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PinInfoCard } from '@/components/pin-info-card';
import type { Item } from '@/lib/schema';

vi.mock('expo-symbols', () => ({ SymbolView: () => null }));

const noop = () => {};

describe('PinInfoCard', () => {
  it('shows the same info as the itinerary row: type label, name, and the address/time/notes lines', () => {
    const item: Item = {
      category: 'meal',
      id: 'lunch',
      name: 'Lunch at the pier',
      time: '12:30',
      notes: 'Window table',
      location: { address: 'Pier 39', lat: 1, lng: 2 },
    };
    render(<PinInfoCard item={item} onOpen={noop} onNavigate={noop} />);
    expect(screen.getByText('MEAL')).toBeInTheDocument();
    expect(screen.getByText('Lunch at the pier')).toBeInTheDocument();
    expect(screen.getByText('Pier 39')).toBeInTheDocument();
    expect(screen.getByText('At 12:30')).toBeInTheDocument();
    expect(screen.getByText('Window table')).toBeInTheDocument();
  });

  it('routes its Details action to the full item', () => {
    const onOpen = vi.fn();
    const item: Item = { category: 'location', id: 'a', name: 'A', location: { lat: 1, lng: 2 } };
    render(<PinInfoCard item={item} onOpen={onOpen} onNavigate={noop} />);
    // Both the body tap and the Details pill carry the "Open item" label.
    act(() => fireEvent.click(screen.getAllByLabelText('Open item')[0]));
    expect(onOpen).toHaveBeenCalled();
  });

  it('offers Directions only when the item has a maps destination', () => {
    const onNavigate = vi.fn();
    const located: Item = { category: 'location', id: 'a', name: 'A', location: { lat: 1, lng: 2 } };
    const { rerender } = render(
      <PinInfoCard item={located} onOpen={noop} onNavigate={onNavigate} />,
    );
    act(() => fireEvent.click(screen.getByLabelText('Open in maps')));
    expect(onNavigate).toHaveBeenCalled();

    const noLocation: Item = { category: 'note', id: 'n', name: 'N' };
    rerender(<PinInfoCard item={noLocation} onOpen={noop} onNavigate={onNavigate} />);
    expect(screen.queryByLabelText('Open in maps')).not.toBeInTheDocument();
  });

  it('shows the checklist with progress and ticks an entry through onToggleChecklistEntry', () => {
    const onToggle = vi.fn();
    const item: Item = {
      category: 'activity',
      id: 'a',
      name: 'Pack',
      checklist: [
        { id: 'c1', label: 'Tent', checked: true },
        { id: 'c2', label: 'Stove', checked: false },
      ],
    };
    render(
      <PinInfoCard item={item} onOpen={noop} onNavigate={noop} onToggleChecklistEntry={onToggle} />,
    );
    expect(screen.getByText('1/2')).toBeInTheDocument();
    act(() => fireEvent.click(screen.getByLabelText('Stove')));
    expect(onToggle).toHaveBeenCalledWith('c2');
  });
});
