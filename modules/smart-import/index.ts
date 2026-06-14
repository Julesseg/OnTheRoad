// The native module registers itself under the name "SmartImport"
// (see ios/SmartImportModule.swift) and is autolinked from this local module
// folder. The app-facing JS API — invoking on-device generation and turning the
// model's draft into a persisted-ready Trip — lives in lib/smart-import.ts, which
// loads this native module by name with requireOptionalNativeModule and validates
// the draft through the same TripSchema gate as JSON Import.
export {
  draftToTrip,
  generateTripDraft,
  smartImportTrip,
  DraftTripSchema,
} from '@/lib/smart-import';
export type { DraftTrip, SmartImportResult, SmartImportDeps } from '@/lib/smart-import';
