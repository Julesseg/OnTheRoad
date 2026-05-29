/**
 * The on-disk location of a trip's wallpaper, relative to DocumentsDirectory.
 * Each trip keeps its cover photo in its own folder so deleting a trip can drop
 * the folder wholesale. Stored as `trip.wallpaperUri` (issue #15).
 */
export function wallpaperRelativePath(tripId: string): string {
  return `trips/${tripId}/wallpaper.jpg`;
}
