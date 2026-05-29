import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { TripSummary } from '@/lib/schema';
import { useTripStore } from '@/lib/store';
import TripsScreen from '@/app/(tabs)/trips';

vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('expo-router', () => ({ router: { push: vi.fn() } }));
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { SafeAreaView: Passthrough };
});
vi.mock('expo-glass-effect', async () => {
  const React = await import('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { GlassView: Passthrough, GlassContainer: Passthrough };
});
vi.mock('expo-image', async () => {
  const React = await import('react');
  const Image = ({ source }: { source?: { uri?: string } }) =>
    React.createElement('img', { 'data-testid': 'wallpaper', src: source?.uri });
  return { Image };
});
vi.mock('@/lib/storage', () => ({
  wallpaperDisplayUri: (relativePath: string) => `display:${relativePath}`,
}));

const mockedStore = vi.mocked(useTripStore);

function setStore(state: Record<string, unknown>) {
  mockedStore.mockReturnValue({
    initialized: true,
    initialize: vi.fn(),
    importTrip: vi.fn(),
    trips: [],
    ...state,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Trips tab', () => {
  it('shows an empty state when there are no trips', () => {
    setStore({ trips: [] });
    render(<TripsScreen />);
    expect(screen.getByText('No trips yet.')).toBeInTheDocument();
  });

  it('renders a card for each saved trip', () => {
    const summary: TripSummary = {
      id: 'trip-1',
      title: 'Pacific Coast Highway',
      startDate: '2099-07-01',
      endDate: '2099-07-02',
    };
    setStore({ trips: [summary] });
    render(<TripsScreen />);
    expect(screen.getByText('Pacific Coast Highway')).toBeInTheDocument();
    expect(screen.getByText('2099-07-01 — 2099-07-02')).toBeInTheDocument();
  });

  it('renders the wallpaper as a card background when the trip has one', () => {
    const summary: TripSummary = {
      id: 'trip-1',
      title: 'Pacific Coast Highway',
      startDate: '2099-07-01',
      endDate: '2099-07-02',
      wallpaperUri: 'trips/trip-1/wallpaper.jpg',
    };
    setStore({ trips: [summary] });
    render(<TripsScreen />);
    const image = screen.getByTestId('wallpaper');
    expect(image).toHaveAttribute('src', 'display:trips/trip-1/wallpaper.jpg');
  });

  it('lays a legibility scrim over a wallpapered card', () => {
    const summary: TripSummary = {
      id: 'trip-1',
      title: 'Pacific Coast Highway',
      startDate: '2099-07-01',
      endDate: '2099-07-02',
      wallpaperUri: 'trips/trip-1/wallpaper.jpg',
    };
    setStore({ trips: [summary] });
    render(<TripsScreen />);
    expect(screen.getByTestId('wallpaper-scrim')).toBeInTheDocument();
  });

  it('renders no wallpaper image for a trip without one', () => {
    const summary: TripSummary = {
      id: 'trip-1',
      title: 'Pacific Coast Highway',
      startDate: '2099-07-01',
      endDate: '2099-07-02',
    };
    setStore({ trips: [summary] });
    render(<TripsScreen />);
    expect(screen.queryByTestId('wallpaper')).toBeNull();
    expect(screen.queryByTestId('wallpaper-scrim')).toBeNull();
  });
});
