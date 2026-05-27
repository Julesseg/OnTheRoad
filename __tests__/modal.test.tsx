import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ModalScreen from '@/app/modal';

vi.mock('expo-router', async () => {
  const React = await import('react');
  const Link = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { Link };
});

describe('Modal screen', () => {
  it('renders its heading and a link back to home', () => {
    render(<ModalScreen />);
    expect(screen.getByText('This is a modal')).toBeInTheDocument();
    expect(screen.getByText('Go to home screen')).toBeInTheDocument();
  });
});
