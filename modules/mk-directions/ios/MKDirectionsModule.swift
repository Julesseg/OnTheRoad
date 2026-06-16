import ExpoModulesCore
import MapKit

// On-device road-following trip route (issue #124, ADR-0009). Wraps Apple's
// MKDirections (driving) to turn one leg — a pair of endpoint coordinates — into
// the road polyline that feeds the existing expo-maps polyline rendering. No API
// key and no external host: MapKit is already linked.
//
// Returns the route as a JSON array of `[lat, lng]` pairs. When MapKit finds no
// drivable path (an over-water hop, a flight) it returns an empty array `[]`,
// the JS wrapper's signal to fall back to a straight line — the route is never
// missing. A failed request (offline) surfaces as a rejected promise, which the
// wrapper also turns into the straight-line fallback.
//
// Registered under the name "MKDirections"; the JS wrapper loads it with
// requireOptionalNativeModule, so its absence (Simulator / unsupported) is just
// another fallback path rather than a crash. Legs are computed one at a time and
// cached on-device by the app, so MapKit's burst throttling isn't tripped.
public class MKDirectionsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MKDirections")

    AsyncFunction("routeLeg") {
      (fromLat: Double, fromLng: Double, toLat: Double, toLng: Double) async throws -> String in
      try await routeLegJSON(fromLat: fromLat, fromLng: fromLng, toLat: toLat, toLng: toLng)
    }
  }
}

private func routeLegJSON(
  fromLat: Double,
  fromLng: Double,
  toLat: Double,
  toLng: Double
) async throws -> String {
  let request = MKDirections.Request()
  request.transportType = .automobile
  request.requestsAlternateRoutes = false
  request.source = MKMapItem(
    placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: fromLat, longitude: fromLng)))
  request.destination = MKMapItem(
    placemark: MKPlacemark(coordinate: CLLocationCoordinate2D(latitude: toLat, longitude: toLng)))

  let directions = MKDirections(request: request)

  let route: MKRoute?
  do {
    route = try await directions.calculate().routes.first
  } catch let error as MKError where error.code == .directionsNotFound || error.code == .placemarkNotFound {
    // No drivable path between these points — not a failure, a straight-line
    // fallback. Empty array tells the JS wrapper to draw the approximate line.
    return "[]"
  }

  guard let route else { return "[]" }

  // The polyline's points, projected back to lat/lng, as `[[lat, lng], …]`.
  let polyline = route.polyline
  let count = polyline.pointCount
  var pairs: [[Double]] = []
  pairs.reserveCapacity(count)
  let points = polyline.points()
  for i in 0..<count {
    let coordinate = points[i].coordinate
    pairs.append([coordinate.latitude, coordinate.longitude])
  }

  let data = try JSONSerialization.data(withJSONObject: pairs)
  return String(decoding: data, as: UTF8.self)
}
