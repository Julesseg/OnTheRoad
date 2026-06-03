import { describe, it, expect } from 'vitest';
import { tripFormSchema, clampRange } from './trip-form';

describe('tripFormSchema', () => {
  it('rejects a blank title with a friendly message', () => {
    const result = tripFormSchema.safeParse({
      title: '   ',
      startDate: '2026-07-01',
      endDate: '2026-07-03',
    });
    expect(result.success).toBe(false);
    const titleIssue = result.success
      ? undefined
      : result.error.issues.find((i) => i.path[0] === 'title');
    expect(titleIssue?.message).toMatch(/title/i);
  });

  it('flags the end date when it precedes the start date', () => {
    const result = tripFormSchema.safeParse({
      title: 'Coast',
      startDate: '2026-07-10',
      endDate: '2026-07-05',
    });
    expect(result.success).toBe(false);
    const endIssue = result.success
      ? undefined
      : result.error.issues.find((i) => i.path[0] === 'endDate');
    expect(endIssue?.message).toMatch(/before the start/i);
  });

  it('accepts an equal start and end and trims the title', () => {
    const result = tripFormSchema.safeParse({
      title: '  Coast Run  ',
      startDate: '2026-07-01',
      endDate: '2026-07-01',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe('Coast Run');
  });
});

describe('clampRange', () => {
  const range = { startDate: '2026-07-01', endDate: '2026-07-03' };

  it('drags the end along when the start moves past it', () => {
    expect(clampRange('start', '2026-07-20', range)).toEqual({
      startDate: '2026-07-20',
      endDate: '2026-07-20',
    });
  });

  it('drags the start along when the end moves before it', () => {
    expect(clampRange('end', '2026-06-15', range)).toEqual({
      startDate: '2026-06-15',
      endDate: '2026-06-15',
    });
  });

  it('leaves the other endpoint untouched when the range stays valid', () => {
    expect(clampRange('start', '2026-07-02', range)).toEqual({
      startDate: '2026-07-02',
      endDate: '2026-07-03',
    });
    expect(clampRange('end', '2026-07-05', range)).toEqual({
      startDate: '2026-07-01',
      endDate: '2026-07-05',
    });
  });
});
