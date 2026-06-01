import { describe, it, expect } from 'vitest';
import { tripHeaderModel } from './trip-header';
import type { TripSummary } from './schema';

const summary = (over: Partial<TripSummary> & Pick<TripSummary, 'id'>): TripSummary => ({
  title: over.id,
  startDate: '2026-07-01',
  endDate: '2026-07-10',
  wallpaperUri: undefined,
  ...over,
});

const TODAY = '2026-06-01';

describe('tripHeaderModel', () => {
  it('is empty when there are no trips', () => {
    expect(tripHeaderModel(null, [], null, TODAY)).toEqual({ mode: 'empty' });
  });

  it('is home — no back-arrow, no star — when the Displayed Trip is the resolved default', () => {
    const a = summary({ id: 'a' });
    const model = tripHeaderModel(null, [a], null, TODAY);
    expect(model).toEqual({ mode: 'home', tripId: 'a', showBackArrow: false, showStar: false });
  });

  it('browsing a non-default upcoming trip shows the back-arrow and the star', () => {
    const a = summary({ id: 'a', startDate: '2026-07-01', endDate: '2026-07-10' });
    const b = summary({ id: 'b', startDate: '2026-09-01', endDate: '2026-09-10' });
    // `a` is the resolved default (earliest current-or-next); browsing `b`.
    const model = tripHeaderModel('b', [a, b], null, TODAY);
    expect(model).toEqual({ mode: 'browsing', tripId: 'b', showBackArrow: true, showStar: true });
  });

  it('browsing a past trip keeps the back-arrow but hides the star (cannot favorite)', () => {
    const upcoming = summary({ id: 'up', startDate: '2026-07-01', endDate: '2026-07-10' });
    const past = summary({ id: 'past', startDate: '2026-05-01', endDate: '2026-05-10' });
    const model = tripHeaderModel('past', [upcoming, past], null, TODAY);
    expect(model).toEqual({
      mode: 'browsing',
      tripId: 'past',
      showBackArrow: true,
      showStar: false,
    });
  });

  it('collapses back to home once the browsed trip is promoted to favorite', () => {
    const a = summary({ id: 'a', startDate: '2026-07-01', endDate: '2026-07-10' });
    const b = summary({ id: 'b', startDate: '2026-09-01', endDate: '2026-09-10' });
    // Star tapped: `b` is now the favorite, so it is also the resolved default.
    const model = tripHeaderModel('b', [a, b], 'b', TODAY);
    expect(model).toEqual({ mode: 'home', tripId: 'b', showBackArrow: false, showStar: false });
  });
});
