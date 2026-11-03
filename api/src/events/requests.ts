import type { Request } from "express";
import { z } from "zod";
import { FieldError } from "../errors.js";

// Routes call the read functions at the bottom of this file. Each one checks
// one part of a request and returns clean values, or throws, and the error
// handler turns that into a 400 reply that lists what's wrong with each field.

// Text that can't be blank, up to a maximum length.
const text = (maxLength: number) => z.string().trim().min(1).max(maxLength);

// Any ISO 8601 time, like "2026-11-06T13:00:00-05:00", saved in UTC
// ("2026-11-06T18:00:00.000Z") so the database can compare times as text.
const time = z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString());

const email = z.string().trim().toLowerCase().pipe(z.email());

// GET /api/v1/events?q=robotics&category=Technology&from=...&to=...&email=...
const eventFilters = z.object({
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

const newEvent = eventFields.refine((event) => event.endsAt > event.startsAt, {
  path: ["endsAt"],
  message: "Must be after startsAt",
});

const eventChanges = eventFields.partial();

const rsvpRequest = z.object({ email });

export type EventFilters = z.infer<typeof eventFilters>;
export type NewEvent = z.infer<typeof newEvent>;
export type EventChanges = z.infer<typeof eventChanges>;

export function readFilters(request: Request): EventFilters {
  return eventFilters.parse(request.query);
}

// The :id in URLs like /events/7.
export function readEventId(request: Request): number {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1) throw new FieldError("id", "Must be a whole number above 0");
  return id;
}

export function readNewEvent(request: Request): NewEvent {
  return newEvent.parse(request.body);
}

export function readEventChanges(request: Request): EventChanges {
  return eventChanges.parse(request.body);
}

// From the URL when cancelling (/rsvps/:email), otherwise from the body.
export function readEmail(request: Request): string {
  return rsvpRequest.parse({ email: request.params.email ?? request.body?.email }).email;
}
