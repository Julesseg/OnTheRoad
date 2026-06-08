import React from 'react';
import { describe, it, expect } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { Trip } from '@/lib/schema';
import type { Viewport } from '@/lib/trip-route';
import { TripMap, type TripMapHandle } from './trip-map';

function makeTrip(items: Trip['days'][number]['items']): Trip {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    schemaVersion: 3,
    title: 'Test trip',
    startDate: '2099-07-01',
    endDate: '2099-07-01',
    days: [{ id: 'd1', date: '2099-07-01', items }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('TripMap', () => {
  it('renders the Apple Maps view even when no trip is loaded', () => {
    render(<TripMap trip={null} />);
    expect(screen.getByTestId('apple-maps-view')).toBeInTheDocument();
  });

  it('renders a teal-tinted marker per location with coords, in itinerary order', () => {
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'Golden Gate', location: { lat: 37.8199, lng: -122.4783 } },
      { category: 'note' as const, id: 'n', name: 'skip me' },
      { category: 'location' as const, id: 'b', name: 'Big Sur', location: { lat: 36.2704, lng: -121.8081 } },
    ]);
    render(<TripMap trip={trip} />);
    const map = screen.getByTestId('apple-maps-view');
    expect(map.getAttribute('data-markers')).toBe('37.8199,-122.4783;36.2704,-121.8081');
    expect(map.getAttribute('data-marker-tint')).toBe('#0a7ea4');
  });

  it('connects the markers with a teal polyline in itinerary order', () => {
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'A', location: { lat: 37.8199, lng: -122.4783 } },
      { category: 'location' as const, id: 'b', name: 'B', location: { lat: 36.2704, lng: -121.8081 } },
      { category: 'location' as const, id: 'c', name: 'C', location: { lat: 35.6852, lng: -121.1685 } },
    ]);
    render(<TripMap trip={trip} />);
    const map = screen.getByTestId('apple-maps-view');
    expect(map.getAttribute('data-polyline')).toBe(
      '37.8199,-122.4783;36.2704,-121.8081;35.6852,-121.1685',
    );
    expect(map.getAttribute('data-polyline-color')).toBe('#0a7ea4');
  });

  it('omits the polyline when fewer than two coords are available', () => {
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'Alone', location: { lat: 37.8199, lng: -122.4783 } },
    ]);
    render(<TripMap trip={trip} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-polyline')).toBe('');
  });

  it('defaults to a world view when there is no trip', () => {
    render(<TripMap trip={null} />);
    const map = screen.getByTestId('apple-maps-view');
    expect(map.getAttribute('data-center')).toBe('0,0');
    expect(map.getAttribute('data-zoom')).toBe('1');
  });

  it('centers the camera on the bounding-box midpoint of the route', () => {
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'A', location: { lat: 40, lng: -120 } },
      { category: 'location' as const, id: 'b', name: 'B', location: { lat: 42, lng: -110 } },
    ]);
    render(<TripMap trip={trip} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('41,-115');
  });

  it('re-fits the camera when the trip becomes available after mount', () => {
    // Simulates the real Upcoming visit: trip=null on first render (loadedTrips
    // not yet populated), then loadTripById resolves and the trip prop changes.
    // `cameraPosition` is documented as initial-only, so we must drive the
    // camera imperatively when the coords change.
    const { rerender } = render(<TripMap trip={null} />);
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'A', location: { lat: 40, lng: -120 } },
      { category: 'location' as const, id: 'b', name: 'B', location: { lat: 42, lng: -110 } },
    ]);
    rerender(<TripMap trip={trip} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('41,-115');
  });

  it('exposes recenter() that re-applies the current viewport', () => {
    const ref = React.createRef<TripMapHandle>();
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'A', location: { lat: 40, lng: -120 } },
      { category: 'location' as const, id: 'b', name: 'B', location: { lat: 42, lng: -110 } },
    ]);
    const vpA: Viewport = { coordinates: { latitude: 41, longitude: -115 }, zoom: 8 };
    const vpB: Viewport = { coordinates: { latitude: 50, longitude: -100 }, zoom: 6 };

    const { rerender } = render(<TripMap ref={ref} trip={trip} viewport={vpA} />);
    // useEffect fires on mount (coords key is set) and calls setCameraPosition(vpA).
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('41,-115');

    // Change the viewport prop without changing coords — the useEffect is keyed on
    // coords only, so it won't fire again; the camera stays at vpA.
    rerender(<TripMap ref={ref} trip={trip} viewport={vpB} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('41,-115');

    // recenter() re-applies the current (vpB) viewport — simulating a drift recovery.
    act(() => ref.current!.recenter());
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('50,-100');
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-zoom')).toBe('6');
  });
});
