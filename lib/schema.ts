import { z } from 'zod';

const DateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((s) => {
    const [y, m, d] = s.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return (
      date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
    );
  }, 'Invalid calendar date');

const TimeString = z.string().regex(/^\d{2}:\d{2}$/, 'Expected HH:mm');

export const LocationItemSchema = z.object({
  type: z.literal('location'),
  id: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  time: TimeString.optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

export const AccommodationItemSchema = z.object({
  type: z.literal('accommodation'),
  id: z.string().uuid(),
  name: z.string().min(1),
  address: z.string().optional(),
  checkIn: TimeString.optional(),
  checkOut: TimeString.optional(),
  confirmationNumber: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

export const ActivityItemSchema = z.object({
  type: z.literal('activity'),
  id: z.string().uuid(),
  name: z.string().min(1),
  time: TimeString.optional(),
  duration: z.number().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional(),
});

export const NoteItemSchema = z.object({
  type: z.literal('note'),
  id: z.string().uuid(),
  text: z.string().min(1),
  attachments: z.array(z.string()).optional(),
});

export const ItemSchema = z.discriminatedUnion('type', [
  LocationItemSchema,
  AccommodationItemSchema,
  ActivityItemSchema,
  NoteItemSchema,
]);

export type Item = z.infer<typeof ItemSchema>;

export const DaySchema = z.object({
  id: z.string().uuid(),
  date: DateString,
  items: z.array(ItemSchema),
  notes: z.string().optional(),
});

export type Day = z.infer<typeof DaySchema>;

export const TripSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(1),
  title: z.string().min(1),
  startDate: DateString,
  endDate: DateString,
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
});

export type TripSummary = z.infer<typeof TripSummarySchema>;

export const MapsAppSchema = z.enum(['apple', 'google', 'waze']);

export type MapsApp = z.infer<typeof MapsAppSchema>;

export const AppStateSchema = z.object({
  activeTripId: z.string().uuid().nullable(),
  trips: z.array(TripSummarySchema),
  preferredMapsApp: MapsAppSchema.default('apple'),
  lastUpdated: z.string().datetime(),
});

export type AppState = z.infer<typeof AppStateSchema>;
