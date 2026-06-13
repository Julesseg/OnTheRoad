import { describe, it, expect, vi, beforeEach } from 'vitest';

// The wrapper reads the optional native probe by name; stub Expo's loader so we
// can drive each Foundation Models availability status without a native runtime.
vi.mock('expo', () => ({ requireOptionalNativeModule: vi.fn() }));
import { requireOptionalNativeModule } from 'expo';

import {
  getSmartImportAvailability,
  smartImportUnavailableMessage,
} from './smart-import-availability';

const mockRequire = vi.mocked(requireOptionalNativeModule);

function nativeReturns(status: string) {
  mockRequire.mockReturnValue({ getAvailability: () => status } as never);
}

describe('Smart Import availability', () => {
  beforeEach(() => mockRequire.mockReset());

  it('reports available when the on-device model is ready', () => {
    nativeReturns('available');
    expect(getSmartImportAvailability()).toEqual({ available: true });
  });

  it('passes through each Foundation Models unavailability reason', () => {
    for (const reason of [
      'deviceNotEligible',
      'appleIntelligenceNotEnabled',
      'modelNotReady',
    ] as const) {
      nativeReturns(reason);
      expect(getSmartImportAvailability()).toEqual({ available: false, reason });
    }
  });

  it('falls back to unsupported when the native probe is absent', () => {
    // The simulator and any pre-iOS-26 build have no probe registered, so the
    // module loader returns null — the gate must treat that as unavailable.
    mockRequire.mockReturnValue(null as never);
    expect(getSmartImportAvailability()).toEqual({ available: false, reason: 'unsupported' });
  });

  it('treats an unrecognised native status as unsupported', () => {
    nativeReturns('some-future-status');
    expect(getSmartImportAvailability()).toEqual({ available: false, reason: 'unsupported' });
  });

  it('gives each reason its own user-facing explanation', () => {
    const messages = (['deviceNotEligible', 'appleIntelligenceNotEnabled', 'modelNotReady', 'unsupported'] as const).map(
      smartImportUnavailableMessage,
    );
    // Distinct copy per reason, and each one is non-empty.
    expect(new Set(messages).size).toBe(messages.length);
    for (const m of messages) expect(m.length).toBeGreaterThan(0);
  });
});
