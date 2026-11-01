import { z, type ZodType } from "zod";

// These schemas describe what clients may send. parse() throws a ZodError for
// bad input, and the error handler turns it into a 400 with per-field messages.

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

export function parseId(value: string): number {
  return parse(z.coerce.number().int().positive(), value);
}

const dateTime = z
  .string()
  .datetime({ offset: true, message: "Must be an ISO 8601 date-time" })
  .transform((value) => new Date(value).toISOString());

const queryDate = z.union([dateTime, z.iso.date()]);

export const eventFilters = z
  .object({
    q: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(60).optional(),
    from: queryDate.optional(),
    to: queryDate.optional(),
    email: z.string().trim().email().optional(),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    path: ["to"],
    message: "Must be on or after from",
  });

const eventFields = {
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(5_000),
  category: z.string().trim().min(1).max(60),
  startsAt: dateTime,
  endsAt: dateTime,
  location: z.string().trim().min(1).max(200),
  capacity: z.number().int().positive().max(100_000),
  meetingUrl: z.url().nullable().optional(),
};

export const newEvent = z
  .object(eventFields)
  .strict()
  .refine((value) => value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "Must be after startsAt",
  });

export const eventChanges = z
  .object(eventFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
  .refine((value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "Must be after startsAt",
  });

export const rsvpRequest = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .transform((email) => email.toLowerCase()),
  })
  .strict();

export type EventFilters = z.infer<typeof eventFilters>;
export type NewEvent = z.infer<typeof newEvent>;
export type EventChanges = z.infer<typeof eventChanges>;
