import { requireOptionalNativeModule } from 'expo';

/**
 * The availability gate for Smart Import (see CONTEXT.md#smart-import,
 * ADR-0006). A thin wrapper over the native probe that reads Foundation Models'
 * `SystemLanguageModel.availability`. Foundation Models never runs in the iOS
 * Simulator and is absent on pre-iOS-26 / non-Apple-Intelligence hardware, so
 * the wrapper degrades to `unsupported` whenever the native module is missing —
 * making the unavailable path (the Schema Prompt hand-off) fully exercisable off
 * a real device. No network call is made anywhere here.
 */

export type SmartImportUnavailableReason =
  // Hardware can't run Apple Intelligence (older iPhone) — or no native probe at
  // all (Simulator / older OS); both surface as a permanent "use the prompt" gate.
  | 'unsupported'
  // Apple Intelligence hardware, but the device isn't eligible in this region/config.
  | 'deviceNotEligible'
  // Apple Intelligence is off in Settings.
  | 'appleIntelligenceNotEnabled'
  // Enabled but the model assets are still downloading / warming up.
  | 'modelNotReady';

export type SmartImportAvailability =
  | { available: true }
  | { available: false; reason: SmartImportUnavailableReason };

interface NativeAvailabilityModule {
  /**
   * The current availability as a stable string: `'available'`, or one of the
   * `SystemLanguageModel.UnavailableReason` cases mapped to a camelCase token.
   */
  getAvailability(): string;
}

const KNOWN_REASONS: SmartImportUnavailableReason[] = [
  'deviceNotEligible',
  'appleIntelligenceNotEnabled',
  'modelNotReady',
];

/**
 * Probe whether on-device Smart Import can run right now. Synchronous: the native
 * status is a cheap property read, and call sites gate UI on it.
 */
export function getSmartImportAvailability(): SmartImportAvailability {
  const native = requireOptionalNativeModule<NativeAvailabilityModule>('SmartImportAvailability');
  if (!native) return { available: false, reason: 'unsupported' };

  const status = native.getAvailability();
  if (status === 'available') return { available: true };

  const reason = KNOWN_REASONS.find((r) => r === status) ?? 'unsupported';
  return { available: false, reason };
}

/** User-facing explanation for why Smart Import can't run, shown in the gate alert. */
export function smartImportUnavailableMessage(reason: SmartImportUnavailableReason): string {
  switch (reason) {
    case 'appleIntelligenceNotEnabled':
      return 'Smart Import uses Apple Intelligence, which is turned off on this device. Turn it on in Settings, or copy the Schema Prompt to structure your plan with any AI and import the result.';
    case 'modelNotReady':
      return 'Apple Intelligence is still getting ready on this device. Try again shortly, or copy the Schema Prompt to structure your plan with any AI and import the result.';
    case 'deviceNotEligible':
      return 'This device can’t run Apple Intelligence, which Smart Import needs. Copy the Schema Prompt to structure your plan with any AI, then import the result.';
    case 'unsupported':
      return 'Smart Import needs Apple Intelligence, which isn’t available here. Copy the Schema Prompt to structure your plan with any AI, then import the result through Import Trip.';
  }
}
