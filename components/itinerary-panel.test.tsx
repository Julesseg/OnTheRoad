import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Trip } from '@/lib/schema';
import { ItineraryPanel } from '@/components/itinerary-panel';

vi.mock('expo-glass-effect', async () => {
  const React = await import('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { GlassView: Passthrough, GlassContainer: Passthrough };
});

vi.mock('@/lib/store', () => ({
  useTripStore: (selector: (s: { preferredMapsApp: string; installedMapsApps: string[] }) => unknown) =>
    selector({ preferredMapsApp: 'apple', installedMapsApps: ['apple'] }),
}));

const TRIP: Trip = {
  id: 'trip-1',
  schemaVersion: 2,
  title: 'Pacific Coast Highway',
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  days: [
    {
      id: 'day-1',
      date: '2026-07-01',
      notes: 'Pack sunscreen',
      items: [{ type: 'activity', id: 'a1', name: 'Lunch', time: '12:00' }],
    },
    { id: 'day-2', date: '2026-07-02', items: [] },
  ],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

const BEFORE_TRIP = new Date(2026, 5, 28, 9, 0); // Upcoming — no Next-up

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ItineraryPanel', () => {
  it('renders a header per day with day number, date and notes, plus item rows', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    expect(screen.getByText('Day 1')).toBeInTheDocument();
    expect(screen.getByText('Wed, Jul 1')).toBeInTheDocument();
    expect(screen.getByText('Pack sunscreen')).toBeInTheDocument();
    expect(screen.getByText('Day 2')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
  });

  it('does not render a Next-up card when the trip is not In progress', () => {
    render(<ItineraryPanel trip={TRIP} now={BEFORE_TRIP} />);
    expect(screen.queryByText('Next up')).not.toBeInTheDocument();
  });

  it('renders a Next-up card naming the next item when In progress', () => {
    const inProgress = new Date(2026, 6, 1, 10, 0); // July 1, before the 12:00 activity
    render(<ItineraryPanel trip={TRIP} now={inProgress} />);
    expect(screen.getByText('Next up')).toBeInTheDocument();
    // The item title appears in both the Next-up card and its day's item row.
    expect(screen.getAllByText('Lunch').length).toBeGreaterThanOrEqual(2);
  });
});
