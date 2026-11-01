import type { EventRow, RsvpRow } from "./store.js";

// Database rows use snake_case column names. These functions decide what the
// API promises to clients, so renaming a column never leaks into the API.

export function toEvent(event: EventRow) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    location: event.location,
    meetingUrl: event.meeting_url,
    capacity: event.capacity,
    rsvpCount: Number(event.rsvp_count),
    availableSpots: Math.max(0, event.capacity - Number(event.rsvp_count)),
    createdAt: event.created_at,
    updatedAt: event.updated_at,
    // Only included when the request asked about one person with ?email=...
    ...(event.is_attending === undefined ? {} : { isAttending: event.is_attending === 1 }),
  };
}

export function toRsvp(rsvp: RsvpRow) {
  return {
    id: rsvp.id,
    eventId: rsvp.event_id,
    email: rsvp.email,
    createdAt: rsvp.created_at,
  };
}
