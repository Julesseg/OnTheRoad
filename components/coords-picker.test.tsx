import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CoordsPicker } from '@/components/coords-picker';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CoordsPicker', () => {
  it('offers Paste URL, Search and Pin tabs', () => {
    render(<CoordsPicker onConfirm={() => {}} />);
    expect(screen.getByText('Paste URL')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Pin')).toBeInTheDocument();
  });

  it('parses a pasted URL and returns its coordinates on confirm', async () => {
    const onConfirm = vi.fn();
    render(<CoordsPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Maps URL or coordinates'), {
      target: { value: 'maps://?ll=47.6062,-122.3321' },
    });
    fireEvent.click(screen.getByLabelText('Parse'));

    await screen.findByText('47.6062, -122.3321');

    fireEvent.click(screen.getByLabelText('Use these coordinates'));
    expect(onConfirm).toHaveBeenCalledWith({ lat: 47.6062, lng: -122.3321 });
  });

  it('accepts a raw lat,lng pair typed into the same field', async () => {
    const onConfirm = vi.fn();
    render(<CoordsPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Maps URL or coordinates'), {
      target: { value: '40.0, -3.0' },
    });
    fireEvent.click(screen.getByLabelText('Parse'));
    await screen.findByText('40, -3');

    fireEvent.click(screen.getByLabelText('Use these coordinates'));
    expect(onConfirm).toHaveBeenCalledWith({ lat: 40.0, lng: -3.0 });
  });

  it('resolves a Google short link via the network and confirms its coordinates', async () => {
    const onConfirm = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        url: 'https://www.google.com/maps/place/X/@47.61,-122.34,17z/data=!3d47.6097!4d-122.3422',
        text: async () => '',
      }),
    );
    render(<CoordsPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Maps URL or coordinates'), {
      target: { value: 'https://maps.app.goo.gl/abc123' },
    });
    fireEvent.click(screen.getByLabelText('Parse'));

    await screen.findByText('47.6097, -122.3422');
    fireEvent.click(screen.getByLabelText('Use these coordinates'));
    expect(onConfirm).toHaveBeenCalledWith({ lat: 47.6097, lng: -122.3422 });
  });

  it('re-gates confirm after the field is edited following a successful parse', async () => {
    const onConfirm = vi.fn();
    render(<CoordsPicker onConfirm={onConfirm} />);

    const input = screen.getByLabelText('Maps URL or coordinates');
    fireEvent.change(input, { target: { value: 'maps://?ll=47.6062,-122.3321' } });
    fireEvent.click(screen.getByLabelText('Parse'));
    await screen.findByText('47.6062, -122.3321');

    fireEvent.change(input, { target: { value: '47.6062, -100' } });
    expect(screen.queryByText('47.6062, -122.3321')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Use these coordinates'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('shows an inline error and does not confirm when input cannot be parsed', async () => {
    const onConfirm = vi.fn();
    render(<CoordsPicker onConfirm={onConfirm} />);

    fireEvent.change(screen.getByLabelText('Maps URL or coordinates'), {
      target: { value: 'not a location' },
    });
    fireEvent.click(screen.getByLabelText('Parse'));

    await screen.findByText(/Couldn't read a location/);

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
