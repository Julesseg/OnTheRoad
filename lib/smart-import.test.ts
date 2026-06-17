import { describe, it, expect, vi } from 'vitest';

// smart-import loads the optional native generator by name via expo; stub the
// loader so importing the module doesn't pull in the native runtime under node.
// The orchestration tests inject their own `generate`, so the native path here
// is never exercised — this only keeps the import side-effect-free.
vi.mock('expo', () => ({ requireOptionalNativeModule: vi.fn() }));

import {
  anchorDraft,
  documentStatesCalendarDate,
  draftToTrip,
  eachDateInclusive,
  generateTripDraft,
  smartImportTrip,
  stripUrls,
  type DraftGenerator,
} from './smart-import';
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

describe('anchorDraft', () => {
  // An undated draft as generateTripDraft produces it from a "Day 1 / Day 2"
  // plan: a title and sequential days carrying items, but no calendar dates yet.
  const UNDATED_DRAFT = {
    title: 'Long weekend',
    days: [
      { items: [{ name: 'Drive up the coast' }] },
      { items: [{ name: 'Hike to the falls' }, { name: 'Dinner in town' }] },
      { items: [{ name: 'Drive home' }] },
    ],
  };

  it('anchors the days to consecutive dates from the chosen start, preserving every item', () => {
    const draft = anchorDraft(UNDATED_DRAFT, '2026-09-04');

    expect(draft.startDate).toBe('2026-09-04');
    expect(draft.endDate).toBe('2026-09-06');
    expect(draft.days.map((d) => d.date)).toEqual(['2026-09-04', '2026-09-05', '2026-09-06']);
    expect(draft.days.map((d) => d.items.map((i) => i.name))).toEqual([
      ['Drive up the coast'],
      ['Hike to the falls', 'Dinner in town'],
      ['Drive home'],
    ]);
  });

  it('crosses a month boundary without an off-by-one', () => {
    const draft = anchorDraft(UNDATED_DRAFT, '2026-03-30');
    expect(draft.days.map((d) => d.date)).toEqual(['2026-03-30', '2026-03-31', '2026-04-01']);
  });

  it('produces a draft that draftToTrip turns into a schema-valid trip', () => {
    const result = draftToTrip(anchorDraft(UNDATED_DRAFT, '2026-09-04'), {
      makeId: counterIds(),
      now: '2026-06-13T00:00:00.000Z',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(TripSchema.safeParse(result.trip).success).toBe(true);
    expect(result.trip.days.flatMap((d) => d.items.map((i) => i.name))).toEqual([
      'Drive up the coast',
      'Hike to the falls',
      'Dinner in town',
      'Drive home',
    ]);
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

describe('generateTripDraft', () => {
  it('marks a dated outline as not needing a start date, dates flowing through', async () => {
    const generate: DraftGenerator = {
      outline: vi.fn().mockResolvedValue({
        title: 'Big Sur Weekend',
        startDate: '2026-08-14',
        endDate: '2026-08-15',
      }),
      day: vi.fn(async (_t, date: string) => ({ items: [{ name: `item ${date}` }] })),
    };
    const generated = await generateTripDraft('Big Sur Aug 14-15', generate);

    expect(generated.needsStartDate).toBe(false);
    if (generated.needsStartDate) return;
    expect(generated.draft.startDate).toBe('2026-08-14');
    expect(generated.draft.days.map((d) => d.date)).toEqual(['2026-08-14', '2026-08-15']);
  });

  it('marks an undated outline as needing a start date, days date-less but in order', async () => {
    // The model signals "no dates found" by returning a day count instead of a
    // span (CONTEXT.md#smart-import) — the draft must not carry invented dates.
    const generate: DraftGenerator = {
      outline: vi.fn().mockResolvedValue({ title: 'Camping trip', dayCount: 3 }),
      day: vi.fn(async (_t, _date, dayNumber: number) => ({ items: [{ name: `day ${dayNumber}` }] })),
    };
    const generated = await generateTripDraft('day 1 hike, day 2 fish, day 3 home', generate);

    expect(generated.needsStartDate).toBe(true);
    if (!generated.needsStartDate) return;
    expect(generated.draft.title).toBe('Camping trip');
    expect(generated.draft.days.map((d) => d.items.map((i) => i.name))).toEqual([
      ['day 1'],
      ['day 2'],
      ['day 3'],
    ]);
    // No calendar date exists yet, so each per-day call leans on dayNumber/totalDays.
    expect(generate.day).toHaveBeenNthCalledWith(1, expect.any(String), '', 1, 3, true);
    expect(generate.day).toHaveBeenNthCalledWith(2, expect.any(String), '', 2, 3, false);
    expect(generate.day).toHaveBeenNthCalledWith(3, expect.any(String), '', 3, 3, false);
  });

  it('fails loud when an undated outline claims more days than the cap', async () => {
    const generate: DraftGenerator = {
      outline: vi.fn().mockResolvedValue({ title: 'Forever', dayCount: 365 }),
      day: vi.fn(async () => ({ items: [] })),
    };
    await expect(generateTripDraft('plan', generate)).rejects.toThrow(/too long/i);
    // It fails before grinding through hundreds of per-day inferences.
    expect(generate.day).not.toHaveBeenCalled();
  });

  it('demotes a dated outline to the prompt path when the document states no dates', async () => {
    // The on-device model sometimes sets hasDates=true and invents a span for a
    // plan that has none (issue #98). We don't trust dates the source text can't
    // support: keep the day span as the count, discard the invented dates, prompt.
    const generate: DraftGenerator = {
      outline: vi.fn().mockResolvedValue({
        title: 'Iceland Ring Road',
        startDate: '2026-08-14',
        endDate: '2026-08-16',
      }),
      day: vi.fn(async (_t, _date, dayNumber: number) => ({ items: [{ name: `day ${dayNumber}` }] })),
    };
    const generated = await generateTripDraft('Day 1 land. Day 2 golden circle. Day 3 home.', generate);

    expect(generated.needsStartDate).toBe(true);
    if (!generated.needsStartDate) return;
    expect(generated.draft.title).toBe('Iceland Ring Road');
    // The 3-day span survives as a day count; the fabricated dates are dropped, so
    // each per-day call is date-less and keyed by dayNumber.
    expect(generated.draft.days.map((d) => d.items.map((i) => i.name))).toEqual([
      ['day 1'],
      ['day 2'],
      ['day 3'],
    ]);
    expect(generate.day).toHaveBeenNthCalledWith(1, expect.any(String), '', 1, 3, true);
    expect(generate.day).toHaveBeenNthCalledWith(3, expect.any(String), '', 3, 3, false);
  });
});

describe('stripUrls', () => {
  // Apple's on-device guardrail rejects link-heavy text outright, and the model
  // captures address text only (so it drops URLs anyway) — strip them before
  // generation, tidying the separator a removed link leaves behind.
  it('removes a trailing link and the dash stranded before it', () => {
    expect(stripUrls('teamLab Planets, Toyosu — https://maps.app.goo.gl/teamLabPlanets')).toBe(
      'teamLab Planets, Toyosu',
    );
  });

  it('collapses a link sitting between two dashes, keeping both sides', () => {
    expect(stripUrls('Narisawa — https://www.narisawa-yoshihiro.com — need a reservation')).toBe(
      'Narisawa — need a reservation',
    );
  });

  it('strips bare www. links too', () => {
    expect(stripUrls('JR Pass info — www.japan-guide.com/e/e2018.html')).toBe('JR Pass info');
  });

  it('leaves link-free text untouched', () => {
    expect(stripUrls('Day 1 hike, Day 2 fish')).toBe('Day 1 hike, Day 2 fish');
  });
});

describe('documentStatesCalendarDate', () => {
  it('detects month+day, ISO, and numeric dates', () => {
    expect(documentStatesCalendarDate('Barcelona March 10 to March 12')).toBe(true);
    expect(documentStatesCalendarDate('land on the 18th of April')).toBe(true);
    expect(documentStatesCalendarDate('start 2026-08-14')).toBe(true);
    expect(documentStatesCalendarDate('depart 8/14')).toBe(true);
    expect(documentStatesCalendarDate('Apr 20: drive south')).toBe(true);
  });

  it('does not fire on relative-day plans or bare month words', () => {
    expect(documentStatesCalendarDate('Day 1 hike, Day 2 fish, Day 3 home')).toBe(false);
    expect(documentStatesCalendarDate('we may need to book the ferry')).toBe(false);
    expect(documentStatesCalendarDate('arrive mid-morning, leave in the evening')).toBe(false);
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
    expect(trip).not.toBeNull();
    if (!trip) return;
    expect(trip.title).toBe('Big Sur Weekend');
    expect(trip.days.map((d) => d.date)).toEqual(['2026-08-14', '2026-08-15']);
    expect(trip.days[0].items.map((i) => i.name)).toEqual(['Bixby Creek Bridge']);
    expect(trip.days[1].items.map((i) => i.name)).toEqual(['McWay Falls overlook']);
    expect(TripSchema.safeParse(trip).success).toBe(true);
  });

  it('strips URLs from the document before the model ever sees it', async () => {
    // Apple's guardrail rejects link dumps; the document is sanitized first so a
    // pasted set of map links still imports (the model drops URLs regardless).
    const seen: string[] = [];
    const generate: DraftGenerator = {
      outline: vi.fn(async (t: string) => {
        seen.push(t);
        return { title: 'Tokyo', startDate: '2026-08-14', endDate: '2026-08-14' };
      }),
      day: vi.fn(async (t: string) => {
        seen.push(t);
        return { items: [{ name: 'teamLab Planets' }] };
      }),
    };

    await smartImportTrip('teamLab Planets — https://maps.app.goo.gl/x — go on Aug 14', {
      generate,
      makeId: counterIds(),
    });

    expect(seen.length).toBeGreaterThan(0);
    for (const t of seen) expect(t).not.toMatch(/https?:\/\/|www\./);
  });

  it('flags only day one for unscheduled trip-wide content', async () => {
    const generate = fakeGenerator(
      { title: 'Trip', startDate: '2026-08-14', endDate: '2026-08-15' },
      {},
    );
    await smartImportTrip('Trip Aug 14-15', { generate, makeId: counterIds() });

    expect(generate.day).toHaveBeenNthCalledWith(1, 'Trip Aug 14-15', '2026-08-14', 1, 2, true);
    expect(generate.day).toHaveBeenNthCalledWith(2, 'Trip Aug 14-15', '2026-08-15', 2, 2, false);
  });

  it('degrades a malformed per-day result to no items instead of failing', async () => {
    const generate = fakeGenerator(
      { title: 'Trip', startDate: '2026-08-14', endDate: '2026-08-14' },
      { '2026-08-14': { items: 'not an array' } },
    );
    const trip = await smartImportTrip('Trip on Aug 14', { generate, makeId: counterIds() });
    expect(trip).not.toBeNull();
    if (!trip) return;
    expect(trip.days[0].items).toEqual([]);
  });

  it('throws (saving nothing) when the outline is malformed', async () => {
    const generate = fakeGenerator({ title: '', startDate: 'x', endDate: 'x' }, {});
    await expect(smartImportTrip('garbage', { generate })).rejects.toThrow();
  });

  // A generator the model would back for a dateless plan: the outline reports only
  // a day count, and each per-day call is keyed by dayNumber (there is no date).
  function undatedGenerator(title: string, itemsByDay: Record<number, unknown>): DraftGenerator {
    return {
      outline: vi.fn().mockResolvedValue({ title, dayCount: Object.keys(itemsByDay).length }),
      day: vi.fn(async (_text: string, _date: string, dayNumber: number) => itemsByDay[dayNumber] ?? { items: [] }),
    };
  }

  it('prompts for a start date and anchors a dateless plan to consecutive dates', async () => {
    const generate = undatedGenerator('Camping trip', {
      1: { items: [{ name: 'Hike in' }] },
      2: { items: [{ name: 'Fish' }] },
      3: { items: [{ name: 'Hike out' }] },
    });
    const promptStartDate = vi.fn().mockResolvedValue('2026-09-04');

    const trip = await smartImportTrip('day 1 hike, day 2 fish, day 3 out', {
      generate,
      promptStartDate,
      makeId: counterIds(),
      now: '2026-06-13T00:00:00.000Z',
    });

    expect(promptStartDate).toHaveBeenCalledTimes(1);
    expect(trip).not.toBeNull();
    if (!trip) return;
    expect(trip.startDate).toBe('2026-09-04');
    expect(trip.days.map((d) => d.date)).toEqual(['2026-09-04', '2026-09-05', '2026-09-06']);
    expect(trip.days.flatMap((d) => d.items.map((i) => i.name))).toEqual(['Hike in', 'Fish', 'Hike out']);
    expect(TripSchema.safeParse(trip).success).toBe(true);
  });

  it('aborts with nothing saved when the start-date prompt is cancelled', async () => {
    const generate = undatedGenerator('Camping trip', { 1: { items: [{ name: 'Hike in' }] } });
    const promptStartDate = vi.fn().mockResolvedValue(null);

    const trip = await smartImportTrip('a dateless plan', { generate, promptStartDate });

    expect(trip).toBeNull();
  });

  it('never prompts for a start date when the document already has dates', async () => {
    const generate = fakeGenerator(
      { title: 'Big Sur Weekend', startDate: '2026-08-14', endDate: '2026-08-15' },
      { '2026-08-14': { items: [{ name: 'Bixby Creek Bridge' }] } },
    );
    const promptStartDate = vi.fn().mockResolvedValue('2026-01-01');

    const trip = await smartImportTrip('Big Sur Aug 14-15', {
      generate,
      promptStartDate,
      makeId: counterIds(),
    });

    expect(promptStartDate).not.toHaveBeenCalled();
    expect(trip).not.toBeNull();
    if (!trip) return;
    expect(trip.startDate).toBe('2026-08-14');
  });
});
