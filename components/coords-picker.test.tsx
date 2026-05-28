import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { CoordsPicker } from '@/components/coords-picker';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function photonFetchReturning(features: unknown[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ features }),
  });
}

const PIKE_PLACE_FEATURE = {
  geometry: { coordinates: [-122.3422, 47.6097] },
  properties: { name: 'Pike Place Market', city: 'Seattle' },
};

async function flushDebounce(ms = 250) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
  // Let pending microtasks (fetch -> json -> setState) settle.
  await act(async () => {});
}

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

  it('centers the Pin tab map on the initial coords when provided', () => {
    render(<CoordsPicker initial={{ lat: 48.8566, lng: 2.3522 }} onConfirm={() => {}} />);

    fireEvent.click(screen.getByText('Pin'));
    expect(screen.getByTestId('apple-maps-view').getAttribute('data-center')).toBe(
      '48.8566,2.3522',
    );
  });

  it('falls back to a hardcoded center on the Pin tab when no initial coords are given', () => {
    render(<CoordsPicker onConfirm={() => {}} />);

    fireEvent.click(screen.getByText('Pin'));
    const center = screen.getByTestId('apple-maps-view').getAttribute('data-center');
    expect(center).toBeTruthy();
    expect(center).not.toBe('');
  });

  it('drops a pin on the Pin tab and confirms its coordinates', async () => {
    const onConfirm = vi.fn();
    render(<CoordsPicker onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('Pin'));
    const map = screen.getByTestId('apple-maps-view');
    fireEvent.click(map, { clientX: 47.61, clientY: -122.34 });

    expect(screen.getByTestId('apple-maps-view').getAttribute('data-marker')).toBe(
      '47.61,-122.34',
    );

    fireEvent.click(screen.getByLabelText('Use these coordinates'));
    expect(onConfirm).toHaveBeenCalledWith({ lat: 47.61, lng: -122.34 });
  });

  it('aborts the in-flight Photon request when the SearchTab unmounts', async () => {
    vi.useFakeTimers();
    let captured: AbortSignal | undefined;
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      captured = init.signal ?? undefined;
      return new Promise<never>(() => {});
    });
    vi.stubGlobal('fetch', fetchMock);

    const { unmount } = render(<CoordsPicker onConfirm={() => {}} />);
    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByLabelText('Search for a place'), {
      target: { value: 'pike' },
    });
    await flushDebounce();
    expect(captured?.aborted).toBe(false);

    unmount();
    expect(captured?.aborted).toBe(true);
  });

  it('aborts the in-flight Photon request when the query changes', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<{ ok: true; json: () => Promise<unknown> }>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<CoordsPicker onConfirm={() => {}} />);
    fireEvent.click(screen.getByText('Search'));
    const input = screen.getByLabelText('Search for a place');

    fireEvent.change(input, { target: { value: 'pike' } });
    await flushDebounce();
    const firstSignal = (fetchMock.mock.calls[0][1] as RequestInit).signal!;
    expect(firstSignal.aborted).toBe(false);

    fireEvent.change(input, { target: { value: 'pike place' } });
    await flushDebounce();

    expect(firstSignal.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows a graceful error when the search request fails', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    render(<CoordsPicker onConfirm={() => {}} />);
    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByLabelText('Search for a place'), {
      target: { value: 'pike' },
    });
    await flushDebounce();

    expect(screen.getByText(/Search unavailable/i)).toBeInTheDocument();
  });

  it('does not flash the empty-results message while typing after a previous search', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([PIKE_PLACE_FEATURE]));

    render(<CoordsPicker onConfirm={() => {}} />);
    fireEvent.click(screen.getByText('Search'));
    const input = screen.getByLabelText('Search for a place');
    fireEvent.change(input, { target: { value: 'pike' } });
    await flushDebounce();
    expect(screen.getByText('Pike Place Market')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'pike p' } });
    expect(screen.queryByText(/No matches/i)).not.toBeInTheDocument();
  });

  it('shows an empty-results message when Photon returns no features', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', photonFetchReturning([]));

    render(<CoordsPicker onConfirm={() => {}} />);
    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByLabelText('Search for a place'), {
      target: { value: 'qwertyuiop' },
    });
    await flushDebounce();

    expect(screen.getByText(/No matches/i)).toBeInTheDocument();
  });

  it('shows a loading indicator while a search request is in flight', async () => {
    vi.useFakeTimers();
    let resolveFetch!: (value: { ok: true; json: () => Promise<unknown> }) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<{ ok: true; json: () => Promise<unknown> }>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<CoordsPicker onConfirm={() => {}} />);
    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByLabelText('Search for a place'), {
      target: { value: 'pike' },
    });

    await flushDebounce();
    expect(screen.getByLabelText('Searching')).toBeInTheDocument();

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ features: [PIKE_PLACE_FEATURE] }) });
    });
    expect(screen.queryByLabelText('Searching')).not.toBeInTheDocument();
  });

  it('searches Photon after the debounce and confirms the tapped result', async () => {
    vi.useFakeTimers();
    const fetchMock = photonFetchReturning([PIKE_PLACE_FEATURE]);
    vi.stubGlobal('fetch', fetchMock);

    const onConfirm = vi.fn();
    render(<CoordsPicker onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText('Search'));
    fireEvent.change(screen.getByLabelText('Search for a place'), {
      target: { value: 'pike place' },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    await flushDebounce();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Pike Place Market'));
    expect(onConfirm).toHaveBeenCalledWith(
      { lat: 47.6097, lng: -122.3422 },
      { address: 'Seattle' },
    );
  });
});
