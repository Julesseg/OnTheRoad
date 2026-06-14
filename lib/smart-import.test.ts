import { describe, it, expect, vi } from 'vitest';

// smart-import loads the optional native generator by name via expo; stub the
// loader so importing the module doesn't pull in the native runtime under node.
// The orchestration tests inject their own `generate`, so the native path here
// is never exercised — this only keeps the import side-effect-free.
vi.mock('expo', () => ({ requireOptionalNativeModule: vi.fn() }));

import { draftToTrip, eachDateInclusive, smartImportTrip, type DraftGenerator } from './smart-import';
import { TripSchema } from './schema';

// A counter id factory keeps generated ids deterministic and distinct so tests can
// assert structure without caring about randomness; the real default is newId.
function counterIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

// A minimal dated draft as the on-device model would emit it: no ids, no
// timestamps, no schemaVersion — just title, span, and dated days with items.
const DATED_DRAFT = {
  title: 'Big Sur Weekend',
  startDate: '2026-08-14',
  endDate: '2026-08-15',
  days: [
    { date: '2026-08-14', items: [{ name: 'Bixby Creek Bridge' }] },
    { date: '2026-08-15', items: [{ name: 'McWay Falls overlook' }] },
  ],
};

describe('draftToTrip', () => {
  it('builds a Trip whose days match the document dates, items on the right days', () => {
    const result = draftToTrip(DATED_DRAFT, { makeId: counterIds(), now: '2026-06-13T00:00:00.000Z' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const trip = result.trip;
    expect(trip.title).toBe('Big Sur Weekend');
    expect(trip.startDate).toBe('2026-08-14');
    expect(trip.endDate).toBe('2026-08-15');
    expect(trip.days.map((d) => d.date)).toEqual(['2026-08-14', '2026-08-15']);
    expect(trip.days[0].items.map((i) => i.name)).toEqual(['Bixby Creek Bridge']);
    expect(trip.days[1].items.map((i) => i.name)).toEqual(['McWay Falls overlook']);
  });

  it('app-assigns ids and timestamps; the draft carries none', () => {
    const result = draftToTrip(DATED_DRAFT, { now: '2026-06-13T00:00:00.000Z' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const trip = result.trip;

    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const allIds = [trip.id, ...trip.days.map((d) => d.id), ...trip.days.flatMap((d) => d.items.map((i) => i.id))];
    for (const id of allIds) expect(id).toMatch(uuid);
    // Distinct ids everywhere — nothing reused.
    expect(new Set(allIds).size).toBe(allIds.length);

    expect(trip.schemaVersion).toBe(3);
    expect(trip.createdAt).toBe('2026-06-13T00:00:00.000Z');
    expect(trip.updatedAt).toBe('2026-06-13T00:00:00.000Z');
  });

  it('produces output that passes the same TripSchema gate as JSON Import', () => {
    const result = draftToTrip(DATED_DRAFT, { makeId: counterIds(), now: '2026-06-13T00:00:00.000Z' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(TripSchema.safeParse(result.trip).success).toBe(true);
  });

  it('ignores any ids or timestamps the model emitted, assigning its own', () => {
    // A model that disobeys and emits ids/timestamps must not have them honored.
    const polluted = {
      ...DATED_DRAFT,
      id: 'model-made-this-up',
      createdAt: '1999-01-01T00:00:00.000Z',
      days: [{ id: 'nope', date: '2026-08-14', items: [{ id: 'bad', name: 'X' }] }],
      startDate: '2026-08-14',
      endDate: '2026-08-14',
    };
    const result = draftToTrip(polluted, { makeId: counterIds(), now: '2026-06-13T00:00:00.000Z' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trip.id).not.toBe('model-made-this-up');
    expect(result.trip.days[0].id).not.toBe('nope');
    expect(result.trip.days[0].items[0].id).not.toBe('bad');
    expect(result.trip.createdAt).toBe('2026-06-13T00:00:00.000Z');
  });

  it('keeps locations as address text only, dropping any coordinates', () => {
    const draft = {
      title: 'Coast run',
      startDate: '2026-08-14',
      endDate: '2026-08-14',
      days: [
        {
          date: '2026-08-14',
          items: [
            // A model that leaks coordinates must not have them persisted.
            { name: 'Bixby Bridge', location: { address: 'Bixby Creek Bridge, CA', lat: 36.37, lng: -121.9 } },
          ],
        },
      ],
    };
    const result = draftToTrip(draft, { makeId: counterIds(), now: '2026-06-13T00:00:00.000Z' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trip.days[0].items[0].location).toEqual({ address: 'Bixby Creek Bridge, CA' });
  });

  it('defaults category to activity and assigns ids to checklist entries', () => {
    const draft = {
      title: 'Pack and go',
      startDate: '2026-08-14',
      endDate: '2026-08-14',
      days: [
        {
          date: '2026-08-14',
          items: [
            {
              name: 'Pack the car',
              category: 'note',
              checklist: [{ label: 'Boots' }, { label: 'Sunscreen', checked: true }],
            },
            { name: 'Drive north' }, // no category
          ],
        },
      ],
    };
    const result = draftToTrip(draft, { makeId: counterIds(), now: '2026-06-13T00:00:00.000Z' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [packing, drive] = result.trip.days[0].items;
    expect(drive.category).toBe('activity');
    expect(packing.category).toBe('note');
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(packing.checklist).toHaveLength(2);
    for (const entry of packing.checklist!) expect(entry.id).toMatch(uuid);
    expect(packing.checklist!.map((c) => c.checked)).toEqual([false, true]);
  });

  it('degrades a stray category or time on one item instead of rejecting the trip', () => {
    // Guided generation constrains the *type* of category/time, not the enum or
    // HH:mm format, so the model can still emit "lodging" or "9am". One bad field
    // must not nuke the whole multi-day import — it degrades (category -> default,
    // bad time dropped) while every other field survives.
    const draft = {
      title: 'Coast run',
      startDate: '2026-08-14',
      endDate: '2026-08-14',
      days: [
        {
          date: '2026-08-14',
          items: [
            { name: 'Big Sur Lodge', category: 'lodging', time: '9am' },
            { name: 'McWay Falls', category: 'activity', time: '09:00' },
          ],
        },
      ],
    };
    const result = draftToTrip(draft, { makeId: counterIds(), now: '2026-06-13T00:00:00.000Z' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [lodge, falls] = result.trip.days[0].items;
    expect(lodge.category).toBe('activity'); // off-enum value defaulted
    expect(lodge.time).toBeUndefined(); // mis-formatted time dropped
    expect(falls.category).toBe('activity'); // valid values untouched
    expect(falls.time).toBe('09:00');
  });

  it('fails (saving nothing) on a malformed draft', () => {
    const result = draftToTrip({ title: '', startDate: 'nope', endDate: 'nope', days: [] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.length).toBeGreaterThan(0);
  });
});

describe('eachDateInclusive', () => {
  it('expands a span to every calendar date inclusive, in order', () => {
    expect(eachDateInclusive('2026-08-14', '2026-08-16')).toEqual([
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ]);
  });

  it('returns a single day when start equals end', () => {
    expect(eachDateInclusive('2026-03-12', '2026-03-12')).toEqual(['2026-03-12']);
  });

  it('crosses a month boundary without a DST off-by-one', () => {
    expect(eachDateInclusive('2026-03-30', '2026-04-01')).toEqual([
      '2026-03-30',
      '2026-03-31',
      '2026-04-01',
    ]);
  });

  it('degrades a backwards or unparseable span to a single day', () => {
    expect(eachDateInclusive('2026-08-16', '2026-08-14')).toEqual(['2026-08-16']);
  });

  it('fails loud on an absurdly long span instead of grinding', () => {
    expect(() => eachDateInclusive('2026-01-01', '2027-01-01')).toThrow(/too long/i);
  });
});

describe('smartImportTrip', () => {
  // A two-phase generator the model would back: an outline call, then one items
  // call per calendar date. Injected so the orchestration is testable from JS
  // without a device (issue #97, final acceptance criterion).
  function fakeGenerator(
    outline: { title: string; startDate: string; endDate: string },
    itemsByDate: Record<string, unknown>,
  ): DraftGenerator {
    return {
      outline: vi.fn().mockResolvedValue(outline),
      day: vi.fn(
        async (_text: string, date: string, _dayNumber: number, _totalDays: number) =>
          itemsByDate[date] ?? { items: [] },
      ),
    };
  }

  it('expands the outline to one day per date and fills each from a per-day call', async () => {
    const generate = fakeGenerator(
      { title: 'Big Sur Weekend', startDate: '2026-08-14', endDate: '2026-08-15' },
      {
        '2026-08-14': { items: [{ name: 'Bixby Creek Bridge' }] },
        '2026-08-15': { items: [{ name: 'McWay Falls overlook' }] },
      },
    );
    const trip = await smartImportTrip('Big Sur on Aug 14-15', {
      generate,
      makeId: counterIds(),
      now: '2026-06-13T00:00:00.000Z',
    });

    expect(generate.outline).toHaveBeenCalledWith('Big Sur on Aug 14-15');
    expect(trip.title).toBe('Big Sur Weekend');
    expect(trip.days.map((d) => d.date)).toEqual(['2026-08-14', '2026-08-15']);
    expect(trip.days[0].items.map((i) => i.name)).toEqual(['Bixby Creek Bridge']);
    expect(trip.days[1].items.map((i) => i.name)).toEqual(['McWay Falls overlook']);
    expect(TripSchema.safeParse(trip).success).toBe(true);
  });

  it('flags only day one for unscheduled trip-wide content', async () => {
    const generate = fakeGenerator(
      { title: 'Trip', startDate: '2026-08-14', endDate: '2026-08-15' },
      {},
    );
    await smartImportTrip('plan', { generate, makeId: counterIds() });

    expect(generate.day).toHaveBeenNthCalledWith(1, 'plan', '2026-08-14', 1, 2, true);
    expect(generate.day).toHaveBeenNthCalledWith(2, 'plan', '2026-08-15', 2, 2, false);
  });

  it('degrades a malformed per-day result to no items instead of failing', async () => {
    const generate = fakeGenerator(
      { title: 'Trip', startDate: '2026-08-14', endDate: '2026-08-14' },
      { '2026-08-14': { items: 'not an array' } },
    );
    const trip = await smartImportTrip('plan', { generate, makeId: counterIds() });
    expect(trip.days[0].items).toEqual([]);
  });

  it('throws (saving nothing) when the outline is malformed', async () => {
    const generate = fakeGenerator({ title: '', startDate: 'x', endDate: 'x' }, {});
    await expect(smartImportTrip('garbage', { generate })).rejects.toThrow();
  });
});
