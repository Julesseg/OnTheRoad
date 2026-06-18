import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePickerStore } from '@/lib/location-picker-store';
import { committedLocation } from '@/lib/location-picker-model';
import type { PhotonResult } from '@/lib/photon';

const PIKE: PhotonResult = {
  title: 'Pike Place Market',
  coords: { lat: 47.6097, lng: -122.3422 },
  address: 'Seattle, US',
};

beforeEach(() => {
  usePickerStore.getState().end();
});

describe('location picker store', () => {
  it('begins blank regardless of the item’s current location', () => {
    // A prior session left state behind; beginning a new pick must clear it.
    usePickerStore.getState().begin(() => {});
    usePickerStore.getState().dispatch({ type: 'queryChanged', text: 'leftover' });

    usePickerStore.getState().begin(() => {});
    expect(usePickerStore.getState().state.query).toBe('');
    expect(committedLocation(usePickerStore.getState().state)).toBeNull();
  });

  it('confirm hands the committed location to the editor callback', () => {
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    usePickerStore.getState().dispatch({ type: 'queryChanged', text: 'pike' });
    usePickerStore.getState().dispatch({ type: 'resultsLoaded', results: [PIKE] });

    usePickerStore.getState().confirm();
    expect(onConfirm).toHaveBeenCalledWith({
      address: 'Pike Place Market',
      lat: 47.6097,
      lng: -122.3422,
    });
  });

  it('confirm with nothing selected does not call the callback', () => {
    const onConfirm = vi.fn();
    usePickerStore.getState().begin(onConfirm);
    usePickerStore.getState().confirm();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
