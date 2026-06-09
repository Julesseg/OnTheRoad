import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import type { Item, Trip } from '@/lib/schema';

// Capture the onSubmit prop that ItemEditorScreen passes to ItemEditor.
const editorOnSubmit = vi.hoisted(
  () => ({ current: null as ((item: Item, date: string) => void) | null }),
);

vi.mock('@/components/item-editor', () => ({
  ItemEditor: (props: { onSubmit: (item: Item, date: string) => void }) => {
    editorOnSubmit.current = props.onSubmit;
    return null;
  },
}));

const routerMock = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
const paramsMock = vi.hoisted(
  () => ({ value: {} as Record<string, string | undefined> }),
);

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => paramsMock.value,
  router: routerMock,
}));

const storeMocks = vi.hoisted(() => ({
  upsertItem: vi.fn(),
  moveItem: vi.fn(),
  deleteItem: vi.fn(),
  loadTripById: vi.fn().mockResolvedValue(undefined),
  loadedTrips: {} as Record<string, Trip>,
}));

vi.mock('@/lib/store', () => ({
  useTripStore: () => storeMocks,
}));

vi.mock('@/lib/id', () => ({ newId: () => 'new-id' }));

import ItemEditorScreen from '@/app/trip/[id]/item';

const TRIP: Trip = {
  id: 'trip-1',
  schemaVersion: 3,
  title: 'Road Trip',
  startDate: '2025-06-01',
  endDate: '2025-06-03',
  days: [
    { id: 'day-1', date: '2025-06-01', items: [{ id: 'item-1', name: 'Hike', category: 'activity' }] },
    { id: 'day-2', date: '2025-06-02', items: [] },
    { id: 'day-3', date: '2025-06-03', items: [] },
  ],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const ITEM: Item = { id: 'item-1', name: 'Hike', category: 'activity' };

describe('ItemEditorScreen handleSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorOnSubmit.current = null;
    storeMocks.loadedTrips = { 'trip-1': TRIP };
    paramsMock.value = { id: 'trip-1', dayId: 'day-1', itemId: 'item-1' };
  });

  it('calls upsertItem then moveItem when the date changes', () => {
    render(<ItemEditorScreen />);
    act(() => {
      editorOnSubmit.current!(ITEM, '2025-06-02');
    });
    expect(storeMocks.upsertItem).toHaveBeenCalledWith('trip-1', 'day-1', ITEM);
    expect(storeMocks.moveItem).toHaveBeenCalledWith('trip-1', 'day-1', 'day-2', 'item-1');
    expect(routerMock.back).toHaveBeenCalled();
  });

  it('calls only upsertItem when the date is unchanged', () => {
    render(<ItemEditorScreen />);
    act(() => {
      editorOnSubmit.current!(ITEM, '2025-06-01');
    });
    expect(storeMocks.upsertItem).toHaveBeenCalledWith('trip-1', 'day-1', ITEM);
    expect(storeMocks.moveItem).not.toHaveBeenCalled();
    expect(routerMock.back).toHaveBeenCalled();
  });
});
