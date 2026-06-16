import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { Trip } from '@/lib/schema';
import type { Viewport } from '@/lib/trip-route';
import { TripMap, type TripMapHandle } from './trip-map';
import { EmberPalette } from '@/constants/theme';

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

  it('disables tap-to-select so non-trip points of interest reveal no place card', () => {
    render(<TripMap trip={null} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-selection-enabled')).toBe(
      'false',
    );
  });

  it('renders a coral-tinted marker per location with coords, in itinerary order', () => {
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'Golden Gate', location: { lat: 37.8199, lng: -122.4783 } },
      { category: 'note' as const, id: 'n', name: 'skip me' },
      { category: 'location' as const, id: 'b', name: 'Big Sur', location: { lat: 36.2704, lng: -121.8081 } },
    ]);
    render(<TripMap trip={trip} />);
    const map = screen.getByTestId('apple-maps-view');
    expect(map.getAttribute('data-markers')).toBe('37.8199,-122.4783;36.2704,-121.8081');
    expect(map.getAttribute('data-marker-tint')).toBe(EmberPalette.coral);
  });

  it('connects the markers with a coral polyline in itinerary order', () => {
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
    expect(map.getAttribute('data-polyline-color')).toBe(EmberPalette.coral);
  });

  it('dims pins outside the active date and keeps accent on the active day', () => {
    const trip: Trip = {
      id: '00000000-0000-0000-0000-000000000002',
      schemaVersion: 3,
      title: 'Two-day trip',
      startDate: '2099-07-01',
      endDate: '2099-07-02',
      days: [
        {
          id: 'd1',
          date: '2099-07-01',
          items: [{ category: 'location' as const, id: 'a', name: 'A', location: { lat: 40, lng: -120 } }],
        },
        {
          id: 'd2',
          date: '2099-07-02',
          items: [{ category: 'location' as const, id: 'b', name: 'B', location: { lat: 42, lng: -110 } }],
        },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    render(<TripMap trip={trip} activeDate="2099-07-02" />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-marker-tints')).toBe(
      `#8E8E93;${EmberPalette.coral}`,
    );
  });

  it('dims route legs unless both endpoints are on the active date', () => {
    const trip: Trip = {
      id: '00000000-0000-0000-0000-000000000003',
      schemaVersion: 3,
      title: 'Two-day trip',
      startDate: '2099-07-01',
      endDate: '2099-07-02',
      days: [
        {
          id: 'd1',
          date: '2099-07-01',
          items: [{ category: 'location' as const, id: 'a', name: 'A', location: { lat: 40, lng: -120 } }],
        },
        {
          id: 'd2',
          date: '2099-07-02',
          items: [
            { category: 'location' as const, id: 'b', name: 'B', location: { lat: 42, lng: -110 } },
            { category: 'location' as const, id: 'c', name: 'C', location: { lat: 44, lng: -100 } },
          ],
        },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    render(<TripMap trip={trip} activeDate="2099-07-02" />);
    const map = screen.getByTestId('apple-maps-view');
    // A→B crosses days (grey); B→C is within the active day (accent).
    expect(map.getAttribute('data-polylines')).toBe('40,-120;42,-110|42,-110;44,-100');
    expect(map.getAttribute('data-polyline-colors')).toBe(`#8E8E93;${EmberPalette.coral}`);
  });

  it('keeps all pins accent-tinted when no activeDate is given', () => {
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'A', location: { lat: 40, lng: -120 } },
      { category: 'location' as const, id: 'b', name: 'B', location: { lat: 42, lng: -110 } },
    ]);
    render(<TripMap trip={trip} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-marker-tints')).toBe(
      `${EmberPalette.coral};${EmberPalette.coral}`,
    );
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

  it('shows the user-location dot only when user location is enabled', () => {
    const { rerender } = render(<TripMap trip={null} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-my-location-enabled')).toBe(
      'false',
    );
    rerender(<TripMap trip={null} showUserLocation />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-my-location-enabled')).toBe(
      'true',
    );
  });

  it('hides the native my-location button so it is not redundant with the custom one', () => {
    render(<TripMap trip={null} showUserLocation />);
    expect(
      screen.getByTestId('apple-maps-view').getAttribute('data-my-location-button-enabled'),
    ).toBe('false');
  });

  it('centerOn() moves the camera to the given coordinates', () => {
    const ref = React.createRef<TripMapHandle>();
    render(<TripMap ref={ref} trip={null} />);
    act(() => ref.current!.centerOn({ latitude: 48.85, longitude: 2.35 }));
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('48.85,2.35');
  });

  it('centerOn() lifts the point north when given a panelFraction so it sits above the sheet', () => {
    const ref = React.createRef<TripMapHandle>();
    render(<TripMap ref={ref} trip={null} />);
    act(() => ref.current!.centerOn({ latitude: 48.85, longitude: 2.35 }, { panelFraction: 0.5 }));
    const [lat, lng] = screen.getByTestId('apple-maps-view').getAttribute('data-center')!.split(',');
    // The camera centre sits south of the pin, so the pin appears in the visible
    // area above the sheet. Longitude is unchanged.
    expect(Number(lat)).toBeLessThan(48.85);
    expect(Number(lng)).toBe(2.35);
  });

  it('reports the tapped pin id via onSelectPin', () => {
    const onSelectPin = vi.fn();
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'Golden Gate', location: { lat: 37.8, lng: -122.4 } },
      { category: 'location' as const, id: 'b', name: 'Big Sur', location: { lat: 36.27, lng: -121.8 } },
    ]);
    render(<TripMap trip={trip} onSelectPin={onSelectPin} />);
    act(() => fireEvent.click(screen.getByTestId('map-marker-a')));
    expect(onSelectPin).toHaveBeenLastCalledWith('a');
    act(() => fireEvent.click(screen.getByTestId('map-marker-b')));
    expect(onSelectPin).toHaveBeenLastCalledWith('b');
  });

  it('reports a deselect when empty map is tapped', () => {
    const onDeselect = vi.fn();
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'Golden Gate', location: { lat: 37.8, lng: -122.4 } },
    ]);
    render(<TripMap trip={trip} onDeselect={onDeselect} />);
    act(() => fireEvent.click(screen.getByTestId('apple-maps-view')));
    expect(onDeselect).toHaveBeenCalled();
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
    // useEffect fires on mount and calls setCameraPosition(vpA).
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('41,-115');

    // Changing the viewport values (e.g. today-filter reframe) re-fits the camera
    // imperatively — the animated path — even though coords are unchanged.
    rerender(<TripMap ref={ref} trip={trip} viewport={vpB} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('50,-100');

    // recenter() re-applies the current (vpB) viewport — simulating a drift recovery.
    act(() => ref.current!.recenter());
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('50,-100');
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-zoom')).toBe('6');
  });
});
