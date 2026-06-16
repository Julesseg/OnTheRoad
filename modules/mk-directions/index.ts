// The native module registers itself under the name "MKDirections"
// (see ios/MKDirectionsModule.swift) and is autolinked from this local module
// folder. The app-facing JS API — the LegRouter that turns a pair of endpoints
// into a leg's road polyline, with a null result signalling the straight-line
// fallback — lives in lib/mk-directions.ts, which loads this native module by
// name with requireOptionalNativeModule (ADR-0009).
export { routeLeg } from '@/lib/mk-directions';
