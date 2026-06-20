import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Android (Compose) trip-dates variant. @expo/ui/jetpack-compose is globally
// aliased to a DOM stub (vitest.config.ts): the Material segmented buttons render
// as <button aria-pressed=...> (selected => pressed) and the DateTimePickers as
// <input type=date data-testid="datepicker"> whose change fires onDateSelected.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('expo-router', async () => {
  const React = await import('react');
  const back = vi.fn();
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.Title = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children);
  const Toolbar: any = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  Toolbar.Button = ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) =>
    React.createElement(
      'button',
      { type: 'button', onClick: () => onPress?.(), 'aria-label': accessibilityLabel },
      children,
    );
  Stack.Toolbar = Toolbar;
  return {
    router: { back },
    useLocalSearchParams: vi.fn(),
    Stack,
  };
});
vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('@/lib/date-edit-store', () => ({ useDateEditStore: vi.fn() }));

import { router, useLocalSearchParams } from 'expo-router';
import { useTripStore } from '@/lib/store';
import { useDateEditStore } from '@/lib/date-edit-store';

const PARAMS = { id: 'trip-1', startDate: '2026-06-01', endDate: '2026-06-05' };

function setup(opts: { trip?: any; confirm?: ReturnType<typeof vi.fn> } = {}) {
  const confirm = opts.confirm ?? vi.fn();
  vi.mocked(useLocalSearchParams).mockReturnValue(PARAMS as any);
  vi.mocked(useDateEditStore).mockImplementation((sel: any) => sel({ confirm }));
  const trip = opts.trip ?? { days: [] };
  vi.mocked(useTripStore).mockImplementation((sel: any) =>
    sel({ loadedTrips: { 'trip-1': trip } }),
  );
  return { confirm };
}

afterEach(() => vi.restoreAllMocks());

describe('TripDatesScreen (Android)', () => {
  it('starts in Shift mode with Shift pressed and one date picker', async () => {
    setup();
    const { default: TripDatesScreen } = await import('@/app/trip/[id]/dates.android');
    render(<TripDatesScreen />);
    expect(screen.getByRole('button', { name: /shift the trip/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /adjust dates/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getAllByTestId('datepicker')).toHaveLength(1);
  });

  it('toggles from Shift to Adjust, revealing a second (end) date picker', async () => {
    setup();
    const { default: TripDatesScreen } = await import('@/app/trip/[id]/dates.android');
    render(<TripDatesScreen />);
    expect(screen.getAllByTestId('datepicker')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /adjust dates/i }));
    expect(screen.getByRole('button', { name: /adjust dates/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getAllByTestId('datepicker')).toHaveLength(2);
  });

  it('picking a new start in Shift moves the end by the same offset and stages it on Done', async () => {
    const { confirm } = setup();
    const { default: TripDatesScreen } = await import('@/app/trip/[id]/dates.android');
    render(<TripDatesScreen />);
    // Duration is 4 days (Jun 1 -> Jun 5); moving the start to Jun 10 ends Jun 14.
    fireEvent.change(screen.getByTestId('datepicker'), { target: { value: '2026-06-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(confirm).toHaveBeenCalledWith({
      startDate: '2026-06-10',
      endDate: '2026-06-14',
      mode: 'shift',
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('in Adjust, picking start + end stages the free span on Done', async () => {
    const { confirm } = setup();
    const { default: TripDatesScreen } = await import('@/app/trip/[id]/dates.android');
    render(<TripDatesScreen />);
    fireEvent.click(screen.getByRole('button', { name: /adjust dates/i }));
    const [start, end] = screen.getAllByTestId('datepicker');
    fireEvent.change(start, { target: { value: '2026-06-02' } });
    fireEvent.change(end, { target: { value: '2026-06-09' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(confirm).toHaveBeenCalledWith({
      startDate: '2026-06-02',
      endDate: '2026-06-09',
      mode: 'adjust',
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('Cancel goes back without staging', async () => {
    const { confirm } = setup();
    const { default: TripDatesScreen } = await import('@/app/trip/[id]/dates.android');
    render(<TripDatesScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });
});
