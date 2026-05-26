import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Linking } from 'react-native';
import { ItemRow } from './item-row';
import type { Item } from '@/lib/schema';

vi.mock('@/lib/store', () => ({
  useTripStore: (
    selector: (s: { preferredMapsApp: 'apple' | 'google' | 'waze'; installedMapsApps: string[] }) => unknown,
  ) => selector({ preferredMapsApp: 'apple', installedMapsApps: ['apple'] }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ItemRow', () => {
  it('renders the type label, title, and each formatted line', () => {
    const item: Item = {
      type: 'location',
      id: 'a',
      name: 'Golden Gate Bridge',
      address: '100 Bridge Way',
      time: '09:30',
    };
    render(<ItemRow item={item} />);
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Golden Gate Bridge')).toBeInTheDocument();
    expect(screen.getByText('100 Bridge Way')).toBeInTheDocument();
    expect(screen.getByText('At 09:30')).toBeInTheDocument();
  });

  it('opens a tapped URL inside a line via Linking.openURL', () => {
    const openURL = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const item: Item = {
      type: 'note',
      id: 'd',
      text: 'Book at https://example.com/tickets',
    };
    render(<ItemRow item={item} />);
    fireEvent.click(screen.getByText('https://example.com/tickets'));
    expect(openURL).toHaveBeenCalledWith('https://example.com/tickets');
  });

  it('opens the maps target in the preferred app, labelling the button with that app', () => {
    const openURL = vi.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const item: Item = {
      type: 'location',
      id: 'a',
      name: 'Golden Gate Bridge',
      lat: 37.8199,
      lng: -122.4783,
    };
    render(<ItemRow item={item} />);
    fireEvent.click(screen.getByText('Open in Apple Maps'));
    expect(openURL).toHaveBeenCalledWith('maps://?daddr=37.8199,-122.4783');
  });

  it('shows no maps action for an item without an address or coords', () => {
    const item: Item = { type: 'activity', id: 'c', name: 'Whale watching' };
    render(<ItemRow item={item} />);
    expect(screen.queryByText(/^Open in /)).toBeNull();
  });
});
