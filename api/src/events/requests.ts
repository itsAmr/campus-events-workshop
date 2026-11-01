import { z } from "zod";
import { FieldError } from "../errors.js";

// What clients may send. Calling .parse() on a schema returns the cleaned-up
// value, or throws, and the error handler turns that into a 400 reply that
// lists what's wrong with each field.

// Text that can't be blank, up to a maximum length.
const text = (maxLength: number) => z.string().trim().min(1).max(maxLength);

// Any ISO 8601 time, like "2026-11-06T13:00:00-05:00", saved in UTC
// ("2026-11-06T18:00:00.000Z") so the database can compare times as text.
const time = z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString());

const email = z
  .string()
  .trim()
  .email()
  .transform((value) => value.toLowerCase());

// The :id in URLs like /events/7.
export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw new FieldError("id", "Must be a whole number above 0");
  return id;
}

// GET /events?q=robotics&category=Technology&from=...&to=...&email=...
export const eventFilters = z.object({
  q: text(100).optional(),
  category: text(60).optional(),
  from: time.optional(),
  to: time.optional(),
  email: email.optional(),
});

const eventFields = z.object({
  title: text(120),
  description: text(5000),
  category: text(60),
  startsAt: time,
  endsAt: time,
  location: text(200),
  capacity: z.number().int().positive(),
  meetingUrl: z.url().nullable().optional(),
});

// POST /events
export const newEvent = eventFields.refine((event) => event.endsAt > event.startsAt, {
  path: ["endsAt"],
  message: "Must be after startsAt",
});

// PATCH /events/:id (stretch): any of the same fields.
export const eventChanges = eventFields.partial();

// POST /events/:id/rsvps
export const rsvpRequest = z.object({ email });

// TypeScript types for the values above, used by store.ts.
export type EventFilters = z.infer<typeof eventFilters>;
export type NewEvent = z.infer<typeof newEvent>;
export type EventChanges = z.infer<typeof eventChanges>;
