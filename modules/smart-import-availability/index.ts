// The native module registers itself under the name "SmartImportAvailability"
// (see ios/SmartImportAvailabilityModule.swift) and is autolinked from this
// local module folder. The app-facing JS API — the typed availability result and
// user-facing copy — lives in lib/smart-import-availability.ts, which loads the
// native probe by name with requireOptionalNativeModule so it degrades gracefully
// wherever Foundation Models is absent (Simulator, pre-iOS-26, non-AI hardware).
export {
  getSmartImportAvailability,
  smartImportUnavailableMessage,
} from '@/lib/smart-import-availability';
export type {
  SmartImportAvailability,
  SmartImportUnavailableReason,
} from '@/lib/smart-import-availability';
