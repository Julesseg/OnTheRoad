import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useTripStore } from '@/lib/store';
import SettingsScreen from '@/app/(tabs)/settings';

vi.mock('@/lib/store', () => ({ useTripStore: vi.fn() }));
vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { SafeAreaView: Passthrough };
});

const mockedStore = vi.mocked(useTripStore);
const setPreferredMapsApp = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockedStore.mockReturnValue({
    preferredMapsApp: 'apple',
    setPreferredMapsApp,
    installedMapsApps: ['apple', 'google'],
    initialized: true,
    initialize: vi.fn(),
  } as never);
});

describe('Settings tab', () => {
  it('lists the installed maps apps under the preference section', () => {
    render(<SettingsScreen />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Apple Maps')).toBeInTheDocument();
    expect(screen.getByText('Google Maps')).toBeInTheDocument();
  });

  it('selects a maps app when its row is tapped', () => {
    render(<SettingsScreen />);
    fireEvent.click(screen.getByLabelText('Google Maps'));
    expect(setPreferredMapsApp).toHaveBeenCalledWith('google');
  });
});
