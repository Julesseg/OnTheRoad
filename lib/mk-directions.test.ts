import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo', () => ({ requireOptionalNativeModule: vi.fn() }));
import { requireOptionalNativeModule } from 'expo';
import { routeLeg } from './mk-directions';

const mockRequire = vi.mocked(requireOptionalNativeModule);
const from = { lat: 37.8199, lng: -122.4783 };
const to = { lat: 36.2704, lng: -121.8081 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('routeLeg', () => {
  it('returns null when the native module is absent (Simulator / unavailable)', async () => {
    mockRequire.mockReturnValue(null);
    expect(await routeLeg(from, to)).toBeNull();
  });

  it('parses the native JSON pairs into coordinate objects', async () => {
    mockRequire.mockReturnValue({
      routeLeg: vi.fn().mockResolvedValue(
        JSON.stringify([
          [37.8199, -122.4783],
          [37, -122],
          [36.2704, -121.8081],
        ]),
      ),
    });
    expect(await routeLeg(from, to)).toEqual([
      { lat: 37.8199, lng: -122.4783 },
      { lat: 37, lng: -122 },
      { lat: 36.2704, lng: -121.8081 },
    ]);
  });

  it('returns null when the native call yields no drivable route', async () => {
    mockRequire.mockReturnValue({ routeLeg: vi.fn().mockResolvedValue('[]') });
    expect(await routeLeg(from, to)).toBeNull();
  });

  it('returns null when the native call rejects (offline)', async () => {
    mockRequire.mockReturnValue({ routeLeg: vi.fn().mockRejectedValue(new Error('offline')) });
    expect(await routeLeg(from, to)).toBeNull();
  });
});
