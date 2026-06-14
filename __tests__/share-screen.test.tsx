import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, screen, fireEvent } from '@testing-library/react';
import type { Item, Trip, TripSummary } from '@/lib/schema';
import type { ItemEditorProps } from '@/components/item-editor';

// Stub only the network-resolving layer; classifyShare and the rest stay real.
const resolveShareCoordsMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/share-capture', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/share-capture')>()),
  resolveShareCoords: resolveShareCoordsMock,
}));

// Capture the props ShareEditorScreen passes to the (mocked) ItemEditor.
const editorProps = vi.hoisted(() => ({ current: null as ItemEditorProps | null }));
vi.mock('@/components/item-editor', () => ({
  ItemEditor: (props: ItemEditorProps) => {
    editorProps.current = props;
    return null;
  },
}));

const routerMock = vi.hoisted(() => ({ replace: vi.fn() }));
const paramsMock = vi.hoisted(() => ({ value: {} as Record<string, string | undefined> }));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => paramsMock.value,
  router: routerMock,
}));

const storeMocks = vi.hoisted(() => ({
  trips: [] as TripSummary[],
  loadedTrips: {} as Record<string, Trip>,
  activeTripId: null as string | null,
  loadTripById: vi.fn().mockResolvedValue(undefined),
  upsertItem: vi.fn(),
  setDisplayedTrip: vi.fn(),
}));
vi.mock('@/lib/store', () => ({ useTripStore: () => storeMocks }));
vi.mock('@/lib/id', () => ({ newId: () => 'new-id' }));
vi.mock('@/lib/date-utils', () => ({ todayString: () => '2026-06-13' }));

import ShareEditorScreen from '@/app/share';

const T1: TripSummary = { id: 't1', title: 'Big Sur', startDate: '2026-06-10', endDate: '2026-06-20' };
const T2: TripSummary = { id: 't2', title: 'Last Year', startDate: '2025-06-01', endDate: '2025-06-10' };

const TRIP1: Trip = {
  ...T1,
  schemaVersion: 3,
  days: [
    { id: 'd-10', date: '2026-06-10', items: [] },
    { id: 'd-13', date: '2026-06-13', items: [] },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const TRIP2: Trip = {
  ...T2,
  schemaVersion: 3,
  days: [{ id: 'd2-1', date: '2025-06-01', items: [] }],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('ShareEditorScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveShareCoordsMock.mockResolvedValue(null);
    editorProps.current = null;
    storeMocks.trips = [T1, T2];
    storeMocks.loadedTrips = { t1: TRIP1, t2: TRIP2 };
    storeMocks.activeTripId = null;
    paramsMock.value = { url: 'https://example.com/place', text: 'Sunset Point' };
  });

  it('defaults the trip selector to the resolved active trip', () => {
    render(<ShareEditorScreen />);
    expect(editorProps.current!.selectedTripId).toBe('t1');
  });

  it('lists all trips with past ones marked', () => {
    render(<ShareEditorScreen />);
    expect(editorProps.current!.tripOptions).toEqual([
      { id: 't1', label: 'Big Sur', past: false },
      { id: 't2', label: 'Last Year', past: true },
    ]);
  });

  it('seeds the editor with the generic-URL classification (Activity, link in notes)', () => {
    render(<ShareEditorScreen />);
    expect(editorProps.current!.initialItem).toMatchObject({
      name: 'Sunset Point',
      category: 'activity',
      notes: 'https://example.com/place',
    });
  });

  it('defaults the day to today when the resolved trip is in progress', () => {
    render(<ShareEditorScreen />);
    expect(editorProps.current!.initialDate).toBe('2026-06-13');
  });

  it('on Save persists the item, sets the Displayed Trip, and lands home', () => {
    render(<ShareEditorScreen />);
    const item: Item = {
      id: 'new-id',
      name: 'Sunset Point',
      category: 'activity',
      notes: 'https://example.com/place',
    };
    act(() => editorProps.current!.onSubmit(item, '2026-06-13'));
    expect(storeMocks.upsertItem).toHaveBeenCalledWith('t1', 'd-13', item);
    expect(storeMocks.setDisplayedTrip).toHaveBeenCalledWith('t1');
    expect(routerMock.replace).toHaveBeenCalledWith('/');
  });

  it('on Cancel saves nothing and returns home', () => {
    render(<ShareEditorScreen />);
    act(() => editorProps.current!.onCancel!());
    expect(storeMocks.upsertItem).not.toHaveBeenCalled();
    expect(storeMocks.setDisplayedTrip).not.toHaveBeenCalled();
    expect(routerMock.replace).toHaveBeenCalledWith('/');
  });

  it('seeds the editor with a Place carrying coordinates resolved for a maps share', async () => {
    paramsMock.value = { url: 'https://maps.app.goo.gl/abc123', text: 'Eiffel Tower' };
    resolveShareCoordsMock.mockResolvedValue({ lat: 48.8584, lng: 2.2945 });

    await act(async () => {
      render(<ShareEditorScreen />);
    });

    expect(editorProps.current!.initialItem).toMatchObject({
      name: 'Eiffel Tower',
      category: 'location',
      notes: 'https://maps.app.goo.gl/abc123',
      location: { lat: 48.8584, lng: 2.2945 },
    });
  });

  it('still seeds an address-only Place when coordinate resolution finds no pin', async () => {
    paramsMock.value = {
      url: 'https://maps.app.goo.gl/abc123',
      text: 'Eiffel Tower\n5 Av. Anatole France',
    };
    resolveShareCoordsMock.mockResolvedValue(null);

    await act(async () => {
      render(<ShareEditorScreen />);
    });

    const item = editorProps.current!.initialItem!;
    expect(item.category).toBe('location');
    expect(item.location).toEqual({ address: '5 Av. Anatole France' });
  });

  it('switching the trip selection re-targets Save onto the chosen trip', () => {
    render(<ShareEditorScreen />);
    act(() => editorProps.current!.onSelectTrip!('t2'));
    expect(editorProps.current!.selectedTripId).toBe('t2');

    const item: Item = { id: 'new-id', name: 'Sunset Point', category: 'activity' };
    act(() => editorProps.current!.onSubmit(item, '2025-06-01'));
    expect(storeMocks.upsertItem).toHaveBeenCalledWith('t2', 'd2-1', item);
    expect(storeMocks.setDisplayedTrip).toHaveBeenCalledWith('t2');
  });

  describe('when no trips exist', () => {
    beforeEach(() => {
      storeMocks.trips = [];
      storeMocks.loadedTrips = {};
    });

    it('shows a create-a-trip-first state instead of a trip-less editor', () => {
      render(<ShareEditorScreen />);
      expect(editorProps.current).toBeNull();
      expect(screen.getByText(/create a trip first/i)).toBeInTheDocument();
    });

    it('routes to New Trip when the offered action is tapped', () => {
      render(<ShareEditorScreen />);
      act(() => fireEvent.click(screen.getByRole('button', { name: /new trip/i })));
      expect(routerMock.replace).toHaveBeenCalledWith('/trip/new');
    });
  });
});
