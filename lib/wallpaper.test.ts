import { describe, it, expect } from 'vitest';
import { wallpaperRelativePath } from './wallpaper';

describe('wallpaperRelativePath', () => {
  it('builds the per-trip wallpaper path under the trips directory', () => {
    expect(wallpaperRelativePath('01900000-0000-7000-8000-000000000001')).toBe(
      'trips/01900000-0000-7000-8000-000000000001/wallpaper.jpg',
    );
  });

  it('keeps each trip’s wallpaper in its own folder', () => {
    expect(wallpaperRelativePath('a')).not.toBe(wallpaperRelativePath('b'));
  });
});
