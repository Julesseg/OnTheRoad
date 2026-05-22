import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Linking } from 'react-native';
import { ItemRow } from './item-row';
import type { Item } from '@/lib/schema';

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
});
