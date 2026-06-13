import { z } from 'zod';

export const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return (
      date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    );
  }, 'Invalid calendar date');

export const TimeString = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:mm');

export const ItemCategorySchema = z.enum(['activity', 'location', 'stay', 'meal', 'note']);
export type ItemCategory = z.infer<typeof ItemCategorySchema>;

const ChecklistItemSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1),
  checked: z.boolean(),
});

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

const ItemLocationSchema = z.object({
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const ItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  category: ItemCategorySchema.default('activity'),
  time: TimeString.optional(),
  location: ItemLocationSchema.optional(),
  notes: z.string().optional(),
  checklist: z.array(ChecklistItemSchema).optional(),
});

export type Item = z.infer<typeof ItemSchema>;

export const DaySchema = z.object({
  id: z.string().uuid(),
  date: DateString,
  items: z.array(ItemSchema),
});

export type Day = z.infer<typeof DaySchema>;

export const CURRENT_SCHEMA_VERSION = 3;

export const TripSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  title: z.string().min(1),
  startDate: DateString,
  endDate: DateString,
  // Relative path within DocumentsDirectory (e.g. `trips/{id}/wallpaper.jpg`).
  // Absent means the trip has no cover photo.
  wallpaperUri: z.string().optional(),
  days: z.array(DaySchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Trip = z.infer<typeof TripSchema>;

export const TripSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  startDate: DateString,
  endDate: DateString,
  wallpaperUri: z.string().optional(),
});

export type TripSummary = z.infer<typeof TripSummarySchema>;

export const MapsAppSchema = z.enum(['apple', 'google', 'waze']);

export type MapsApp = z.infer<typeof MapsAppSchema>;

export const AppearanceSchema = z.enum(['system', 'light', 'dark']);

export type AppearanceMode = z.infer<typeof AppearanceSchema>;

export const AppStateSchema = z.object({
  activeTripId: z.string().uuid().nullable(),
  trips: z.array(TripSummarySchema),
  preferredMapsApp: MapsAppSchema.default('apple'),
  appearance: AppearanceSchema.default('system'),
  lastUpdated: z.string().datetime(),
});

export type AppState = z.infer<typeof AppStateSchema>;
