import ExpoModulesCore

#if canImport(FoundationModels)
import FoundationModels
#endif

// Thin native probe for Smart Import (issue #96, ADR-0006). Exposes Foundation
// Models' on-device availability to JS as a stable status string. Reads a
// property only — no inference, no network. Registered under the name
// "SmartImportAvailability", which the JS wrapper (lib/smart-import-availability.ts)
// loads with requireOptionalNativeModule. On any build/OS where Foundation Models
// is missing, the module simply isn't useful and JS treats it as unsupported.
public class SmartImportAvailabilityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SmartImportAvailability")

    // Synchronous: availability is a cheap property read and the UI gates on it.
    Function("getAvailability") { () -> String in
      #if canImport(FoundationModels)
      if #available(iOS 26.0, *) {
        switch SystemLanguageModel.default.availability {
        case .available:
          return "available"
        case .unavailable(let reason):
          switch reason {
          case .deviceNotEligible:
            return "deviceNotEligible"
          case .appleIntelligenceNotEnabled:
            return "appleIntelligenceNotEnabled"
          case .modelNotReady:
            return "modelNotReady"
          @unknown default:
            return "unsupported"
          }
        @unknown default:
          return "unsupported"
        }
      }
      #endif
      return "unsupported"
    }
  }
}
