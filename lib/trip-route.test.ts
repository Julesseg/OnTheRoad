import { describe, it, expect } from 'vitest';
import { tripRouteCoords, routeViewport } from './trip-route';
import type { Trip } from './schema';

function makeTrip(days: Trip['days']): Trip {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    schemaVersion: 3,
    title: 'Test trip',
    startDate: '2099-07-01',
    endDate: '2099-07-02',
    days,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('tripRouteCoords', () => {
  it('returns an empty list when the trip has no days with items', () => {
    const trip = makeTrip([{ id: 'd1', date: '2099-07-01', items: [] }]);
    expect(tripRouteCoords(trip)).toEqual([]);
  });

  it('extracts location coords in itinerary order across days', () => {
    const trip = makeTrip([
      {
        id: 'd1',
        date: '2099-07-01',
        items: [
          { category: 'location' as const, id: 'a', name: 'Golden Gate', location: { lat: 37.8199, lng: -122.4783 } },
          { category: 'location' as const, id: 'b', name: 'Big Sur', location: { lat: 36.2704, lng: -121.8081 } },
        ],
      },
      {
        id: 'd2',
        date: '2099-07-02',
        items: [{ category: 'location' as const, id: 'c', name: 'Hearst Castle', location: { lat: 35.6852, lng: -121.1685 } }],
      },
    ]);
    expect(tripRouteCoords(trip)).toEqual([
      { lat: 37.8199, lng: -122.4783 },
      { lat: 36.2704, lng: -121.8081 },
      { lat: 35.6852, lng: -121.1685 },
    ]);
  });

  it('skips locations missing lat or lng and non-location items', () => {
    const trip = makeTrip([
      {
        id: 'd1',
        date: '2099-07-01',
        items: [
          { category: 'note' as const, id: 'n1', name: 'leave early' },
          { category: 'location' as const, id: 'noc', name: 'No coords yet' },
          { category: 'location' as const, id: 'lat-only', name: 'Half-pinned', location: { lat: 40 } },
          { category: 'location' as const, id: 'with', name: 'Yosemite', location: { lat: 37.8651, lng: -119.5383 } },
          { category: 'stay' as const, id: 'h', name: 'Lodge' },
        ],
      },
    ]);
    expect(tripRouteCoords(trip)).toEqual([{ lat: 37.8651, lng: -119.5383 }]);
  });
});

describe('routeViewport', () => {
  it('falls back to a world view when there are no coords', () => {
    expect(routeViewport([])).toEqual({
      coordinates: { latitude: 0, longitude: 0 },
      zoom: 1,
    });
  });

  it('centers on a single coord at a city-level zoom', () => {
    expect(routeViewport([{ lat: 37.8199, lng: -122.4783 }])).toEqual({
      coordinates: { latitude: 37.8199, longitude: -122.4783 },
      zoom: 12,
    });
  });

  it('centers on the bounding-box midpoint and zooms to fit the span', () => {
    const vp = routeViewport([
      { lat: 40, lng: -120 },
      { lat: 42, lng: -110 },
      { lat: 41, lng: -115 },
    ]);
    expect(vp.coordinates).toEqual({ latitude: 41, longitude: -115 });
    // 10-degree longitude span at the equator — should pick a regional zoom,
    // not city-level (12+) and not world (≤2).
    expect(vp.zoom).toBeGreaterThanOrEqual(3);
    expect(vp.zoom).toBeLessThanOrEqual(6);
  });

  it('clamps to a max city-level zoom for very tightly packed coords', () => {
    const vp = routeViewport([
      { lat: 37.8199, lng: -122.4783 },
      { lat: 37.82, lng: -122.4784 },
    ]);
    expect(vp.zoom).toBeLessThanOrEqual(14);
    expect(vp.zoom).toBeGreaterThanOrEqual(12);
  });
});
