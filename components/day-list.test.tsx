import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Trip } from '@/lib/schema';
import { DayList } from './day-list';

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
      items: [
        { type: 'location', id: 'i1', name: 'Bridge' },
        { type: 'note', id: 'i2', text: 'pack snacks' },
      ],
    },
    { id: 'day-2', date: '2026-07-02', items: [] },
  ],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DayList', () => {
  it('renders each day with its date and item count', () => {
    render(<DayList trip={TRIP} onSelectDay={vi.fn()} />);
    expect(screen.getByLabelText('2026-07-01')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByLabelText('2026-07-02')).toBeInTheDocument();
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('marks the day matching todayDate with a Today badge', () => {
    render(<DayList trip={TRIP} todayDate="2026-07-02" onSelectDay={vi.fn()} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('calls onSelectDay with the day id when a row is tapped', () => {
    const onSelectDay = vi.fn();
    render(<DayList trip={TRIP} onSelectDay={onSelectDay} />);
    fireEvent.click(screen.getByLabelText('2026-07-01'));
    expect(onSelectDay).toHaveBeenCalledWith('day-1');
  });
});
