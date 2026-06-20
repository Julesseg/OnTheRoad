import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { Trip } from '@/lib/schema';
import type { Viewport } from '@/lib/trip-route';
import { TripMap, type TripMapHandle } from './trip-map.android';
import { legCacheKey } from '@/lib/route-cache';
import { EmberPalette } from '@/constants/theme';

// The expo-maps test stub renders GoogleMaps.View with the same data-* contract as
// AppleMaps.View, so these tests pin the Android map variant against the shared
// TripMapHandle/props contract: pins, straight-only legs (ADR-0015), dimming,
// camera framing/recenter, result + dropped pins, and pin-tap reporting.

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

describe('TripMap (Android / GoogleMaps)', () => {
  it('renders the Google map view even when no trip is loaded', () => {
    render(<TripMap trip={null} />);
    expect(screen.getByTestId('apple-maps-view')).toBeInTheDocument();
  });

  it('renders a coral-tinted marker per located item in itinerary order', () => {
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

  it('draws straight legs only — ignoring any road geometry — at the approximate width', () => {
    const a = { lat: 37.8199, lng: -122.4783 };
    const b = { lat: 36.2704, lng: -121.8081 };
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'A', location: a },
      { category: 'location' as const, id: 'b', name: 'B', location: b },
    ]);
    // Even when a caller supplies road geometry, Android renders the straight leg:
    // MKDirections is iOS-only, so the Android route is straight-line for v1.
    const roadLegs = { [legCacheKey(a, b)]: [a, { lat: 37, lng: -122 }, b] };
    render(<TripMap trip={trip} roadLegs={roadLegs} />);
    const map = screen.getByTestId('apple-maps-view');
    expect(map.getAttribute('data-polyline')).toBe('37.8199,-122.4783;36.2704,-121.8081');
    expect(map.getAttribute('data-polyline-widths')).toBe('2');
  });

  it('dims pins and legs outside the active date, keeping accent on the active day', () => {
    const trip: Trip = {
      id: '00000000-0000-0000-0000-000000000002',
      schemaVersion: 3,
      title: 'Two-day trip',
      startDate: '2099-07-01',
      endDate: '2099-07-02',
      days: [
        { id: 'd1', date: '2099-07-01', items: [{ category: 'location' as const, id: 'a', name: 'A', location: { lat: 40, lng: -120 } }] },
        { id: 'd2', date: '2099-07-02', items: [{ category: 'location' as const, id: 'b', name: 'B', location: { lat: 42, lng: -110 } }] },
      ],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    render(<TripMap trip={trip} activeDate="2099-07-02" />);
    const map = screen.getByTestId('apple-maps-view');
    expect(map.getAttribute('data-marker-tints')).toBe(`#8E8E93;${EmberPalette.coral}`);
    expect(map.getAttribute('data-polyline-colors')).toBe('#8E8E93');
  });

  it('greys the trip and layers accent result + dropped pins when dimmed (location picker)', () => {
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'A', location: { lat: 40, lng: -120 } },
    ]);
    render(
      <TripMap trip={trip} dimmed resultPins={[{ lat: 47.6, lng: -122.3 }]} droppedPin={{ lat: 1, lng: 2 }} />,
    );
    const map = screen.getByTestId('apple-maps-view');
    expect(map.getAttribute('data-markers')).toBe('40,-120;47.6,-122.3;1,2');
    expect(map.getAttribute('data-marker-tints')).toBe(`#8E8E93;${EmberPalette.coral};${EmberPalette.coral}`);
  });

  it('centers the camera on the route midpoint and re-fits when the trip arrives', () => {
    const { rerender } = render(<TripMap trip={null} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('0,0');
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'A', location: { lat: 40, lng: -120 } },
      { category: 'location' as const, id: 'b', name: 'B', location: { lat: 42, lng: -110 } },
    ]);
    rerender(<TripMap trip={trip} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('41,-115');
  });

  it('exposes recenter() and centerOn() that drive the camera imperatively', () => {
    const ref = React.createRef<TripMapHandle>();
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'A', location: { lat: 40, lng: -120 } },
      { category: 'location' as const, id: 'b', name: 'B', location: { lat: 42, lng: -110 } },
    ]);
    const vp: Viewport = { coordinates: { latitude: 50, longitude: -100 }, zoom: 6 };
    render(<TripMap ref={ref} trip={trip} viewport={vp} />);
    act(() => ref.current!.centerOn({ latitude: 48.85, longitude: 2.35 }));
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('48.85,2.35');
    act(() => ref.current!.recenter());
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe('50,-100');
  });

  it('reports the tapped pin id, deselect, and map-tap coordinates', () => {
    const onSelectPin = vi.fn();
    const onDeselect = vi.fn();
    const onMapPress = vi.fn();
    const trip = makeTrip([
      { category: 'location' as const, id: 'a', name: 'A', location: { lat: 37.8, lng: -122.4 } },
    ]);
    render(<TripMap trip={trip} onSelectPin={onSelectPin} onDeselect={onDeselect} onMapPress={onMapPress} />);
    act(() => fireEvent.click(screen.getByTestId('map-marker-a')));
    expect(onSelectPin).toHaveBeenLastCalledWith('a');
    act(() => fireEvent.click(screen.getByTestId('apple-maps-view'), { clientX: 48.85, clientY: 2.35 }));
    expect(onDeselect).toHaveBeenCalled();
    expect(onMapPress).toHaveBeenCalledWith({ lat: 48.85, lng: 2.35 });
  });

  it('disables tap-to-select unless a POI handler is provided', () => {
    const { rerender } = render(<TripMap trip={null} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-selection-enabled')).toBe('false');
    rerender(<TripMap trip={null} onPoiSelect={() => {}} />);
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-selection-enabled')).toBe('true');
  });
});
