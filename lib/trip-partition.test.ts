import { describe, it, expect } from 'vitest';
import type { TripSummary } from './schema';
import { partitionTrips } from './trip-partition';

function makeSummary(id: string, startDate: string, endDate: string): TripSummary {
  return { id, title: id, startDate, endDate };
}

describe('partitionTrips', () => {
  it('returns empty groups for empty input', () => {
    const result = partitionTrips([], '2026-06-01');
    expect(result).toEqual({ active: { inProgress: [], upcoming: [] }, archived: [] });
  });

  it('places a past trip in archived', () => {
    const past = makeSummary('past', '2026-05-01', '2026-05-31');
    const { active, archived } = partitionTrips([past], '2026-06-01');
    expect(archived).toEqual([past]);
    expect(active.inProgress).toEqual([]);
    expect(active.upcoming).toEqual([]);
  });

  it('boundary: trip ending today is still active (in-progress), not archived', () => {
    const endsToday = makeSummary('t', '2026-05-28', '2026-06-01');
    const { active, archived } = partitionTrips([endsToday], '2026-06-01');
    expect(archived).toEqual([]);
    expect(active.inProgress).toEqual([endsToday]);
  });

  it('boundary: trip that ended yesterday is archived', () => {
    const endedYesterday = makeSummary('t', '2026-05-28', '2026-05-31');
    const { active, archived } = partitionTrips([endedYesterday], '2026-06-01');
    expect(archived).toEqual([endedYesterday]);
    expect(active.inProgress).toEqual([]);
  });

  it('places an upcoming trip in active.upcoming', () => {
    const upcoming = makeSummary('u', '2026-07-01', '2026-07-10');
    const { active, archived } = partitionTrips([upcoming], '2026-06-01');
    expect(active.upcoming).toEqual([upcoming]);
    expect(active.inProgress).toEqual([]);
    expect(archived).toEqual([]);
  });

  it('boundary: trip starting today is in-progress, not upcoming', () => {
    const startsToday = makeSummary('t', '2026-06-01', '2026-06-10');
    const { active } = partitionTrips([startsToday], '2026-06-01');
    expect(active.inProgress).toEqual([startsToday]);
    expect(active.upcoming).toEqual([]);
  });

  it('correctly partitions a mixed batch', () => {
    const past = makeSummary('past', '2026-04-01', '2026-04-30');
    const inProg = makeSummary('inprog', '2026-05-15', '2026-06-15');
    const upcoming = makeSummary('upcoming', '2026-07-01', '2026-07-31');
    const { active, archived } = partitionTrips([past, inProg, upcoming], '2026-06-01');
    expect(archived).toEqual([past]);
    expect(active.inProgress).toEqual([inProg]);
    expect(active.upcoming).toEqual([upcoming]);
  });

  it('sorts inProgress trips by startDate ascending', () => {
    const a = makeSummary('a', '2026-05-01', '2026-06-30');
    const b = makeSummary('b', '2026-05-20', '2026-06-30');
    const { active } = partitionTrips([b, a], '2026-06-01');
    expect(active.inProgress.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('sorts upcoming trips by startDate ascending', () => {
    const a = makeSummary('a', '2026-08-01', '2026-08-10');
    const b = makeSummary('b', '2026-07-01', '2026-07-10');
    const { active } = partitionTrips([a, b], '2026-06-01');
    expect(active.upcoming.map((s) => s.id)).toEqual(['b', 'a']);
  });
});
