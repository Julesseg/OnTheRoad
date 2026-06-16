import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PinInfoCard } from '@/components/pin-info-card';
import { pinInfoCard } from '@/lib/pin-info-card';

describe('PinInfoCard', () => {
  it('shows the name, time, and notes snippet', () => {
    const card = pinInfoCard({
      category: 'meal',
      id: 'lunch',
      name: 'Lunch at the pier',
      time: '12:30',
      notes: 'Window table',
      location: { lat: 1, lng: 2 },
    });
    render(<PinInfoCard card={card} onOpen={vi.fn()} onNavigate={vi.fn()} />);
    expect(screen.getByText('Lunch at the pier')).toBeInTheDocument();
    expect(screen.getByText('12:30')).toBeInTheDocument();
    expect(screen.getByText('Window table')).toBeInTheDocument();
  });

  it('routes its Details action to the full item', () => {
    const onOpen = vi.fn();
    const card = pinInfoCard({ category: 'location', id: 'a', name: 'A', location: { lat: 1, lng: 2 } });
    render(<PinInfoCard card={card} onOpen={onOpen} onNavigate={vi.fn()} />);
    act(() => fireEvent.click(screen.getByLabelText('Open item')));
    expect(onOpen).toHaveBeenCalled();
  });

  it('offers Directions only when the item has coordinates', () => {
    const located = pinInfoCard({ category: 'location', id: 'a', name: 'A', location: { lat: 1, lng: 2 } });
    const onNavigate = vi.fn();
    const { rerender } = render(
      <PinInfoCard card={located} onOpen={vi.fn()} onNavigate={onNavigate} />,
    );
    act(() => fireEvent.click(screen.getByLabelText('Open in maps')));
    expect(onNavigate).toHaveBeenCalled();

    const noLocation = pinInfoCard({ category: 'note', id: 'n', name: 'N' });
    rerender(<PinInfoCard card={noLocation} onOpen={vi.fn()} onNavigate={onNavigate} />);
    expect(screen.queryByLabelText('Open in maps')).not.toBeInTheDocument();
  });
});
