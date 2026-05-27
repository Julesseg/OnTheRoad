import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { Day } from '@/lib/schema';
import { TodayCompanion } from '@/components/today-companion';

vi.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

const DAY: Day = {
  id: 'day-1',
  date: '2026-07-02',
  items: [
    { type: 'activity', id: 'a', name: 'Breakfast', time: '09:00' },
    { type: 'location', id: 'b', name: 'Museum', time: '11:00', notes: 'buy tickets online first' },
    { type: 'note', id: 'c', text: 'remember sunscreen' },
  ],
};

describe('TodayCompanion', () => {
  it("renders each of the day's item titles", () => {
    render(<TodayCompanion day={DAY} highlightId={null} />);
    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('Museum')).toBeInTheDocument();
  });

  it('renders items in chronological order regardless of stored order', () => {
    const day: Day = {
      id: 'day-1',
      date: '2026-07-02',
      items: [
        { type: 'activity', id: 'late', name: 'Dinner', time: '19:00' },
        { type: 'activity', id: 'early', name: 'Breakfast', time: '08:00' },
      ],
    };
    render(<TodayCompanion day={day} highlightId={null} />);
    const early = screen.getByText('Breakfast');
    const late = screen.getByText('Dinner');
    expect(early.compareDocumentPosition(late) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows a "Next up" badge on the highlighted item', () => {
    render(<TodayCompanion day={DAY} highlightId="b" />);
    const card = screen.getByText('Next up').parentElement as HTMLElement;
    expect(within(card).getByText('Museum')).toBeInTheDocument();
  });

  it('shows no "Next up" badge when there is no highlight', () => {
    render(<TodayCompanion day={DAY} highlightId={null} />);
    expect(screen.queryByText('Next up')).not.toBeInTheDocument();
  });

  it('renders item notes collapsed and expands them on tap', () => {
    render(<TodayCompanion day={DAY} highlightId={null} />);
    const notes = screen.getByLabelText('Notes for Museum');
    expect(notes).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(notes);
    expect(notes).toHaveAttribute('aria-expanded', 'true');
  });
});
