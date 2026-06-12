import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// The native chrome is expo-router's Stack.Header / Stack.Title; Header renders
// nothing and Title renders its text so it stays queryable under jsdom.
/* eslint-disable react/display-name -- inline passthrough stand-ins for native views */
vi.mock('expo-router', async () => {
  const React = await import('react');
  const Stack: any = () => null;
  Stack.Header = () => null;
  Stack.Title = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('span', null, children);
  return { Stack };
});

describe('SmartImportSheet', () => {
  // The Smart Import flow lands in a later slice; until then the Trips-tab
  // menu entry must land somewhere inert that explains itself.
  it('renders the placeholder without crashing', async () => {
    const { default: SmartImportSheet } = await import('@/app/smart-import');
    render(<SmartImportSheet />);

    expect(screen.getByText('Import Planning Document')).toBeInTheDocument();
    expect(screen.getByText(/isn’t available yet/i)).toBeInTheDocument();
  });
});
