import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoordsPicker } from '@/components/coords-picker';

describe('CoordsPicker', () => {
  it('offers Paste URL, Search and Pin tabs', () => {
    render(<CoordsPicker onConfirm={() => {}} />);
    expect(screen.getByText('Paste URL')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Pin')).toBeInTheDocument();
  });

  it('parses a pasted URL and returns its coordinates on confirm', () => {
    const onConfirm = vi.fn();
    render(<CoordsPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Maps URL or coordinates'), {
      target: { value: 'maps://?ll=47.6062,-122.3321' },
    });
    fireEvent.click(screen.getByLabelText('Parse'));

    expect(screen.getByText('47.6062, -122.3321')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Use these coordinates'));
    expect(onConfirm).toHaveBeenCalledWith({ lat: 47.6062, lng: -122.3321 });
  });

  it('accepts a raw lat,lng pair typed into the same field', () => {
    const onConfirm = vi.fn();
    render(<CoordsPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Maps URL or coordinates'), {
      target: { value: '40.0, -3.0' },
    });
    fireEvent.click(screen.getByLabelText('Parse'));
    fireEvent.click(screen.getByLabelText('Use these coordinates'));

    expect(onConfirm).toHaveBeenCalledWith({ lat: 40.0, lng: -3.0 });
  });

  it('re-gates confirm after the field is edited following a successful parse', () => {
    const onConfirm = vi.fn();
    render(<CoordsPicker onConfirm={onConfirm} />);

    const input = screen.getByLabelText('Maps URL or coordinates');
    fireEvent.change(input, { target: { value: 'maps://?ll=47.6062,-122.3321' } });
    fireEvent.click(screen.getByLabelText('Parse'));
    expect(screen.getByText('47.6062, -122.3321')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: '47.6062, -100' } });
    expect(screen.queryByText('47.6062, -122.3321')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Use these coordinates'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows an inline error and does not confirm when input cannot be parsed', () => {
    const onConfirm = vi.fn();
    render(<CoordsPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Maps URL or coordinates'), {
      target: { value: 'not a location' },
    });
    fireEvent.click(screen.getByLabelText('Parse'));

    expect(screen.getByText(/Couldn't read a location/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Use these coordinates'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('marks Search and Pin as coming in a later slice', () => {
    render(<CoordsPicker onConfirm={() => {}} />);

    fireEvent.click(screen.getByText('Search'));
    expect(screen.getByText(/Coming soon/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Pin'));
    expect(screen.getByText(/Coming soon/)).toBeInTheDocument();
  });
});
