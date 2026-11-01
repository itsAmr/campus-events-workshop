import type { EventRow, RsvpRow } from "./store.js";

// Database rows use snake_case column names. These functions decide what each
// API version promises to clients, so a column rename never leaks into the API.

function sharedEventFields(event: EventRow) {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    capacity: event.capacity,
    rsvpCount: Number(event.rsvp_count),
    availableSpots: Math.max(0, event.capacity - Number(event.rsvp_count)),
    createdAt: event.created_at,
    updatedAt: event.updated_at,
    ...(event.is_attending === undefined ? {} : { isAttending: event.is_attending === 1 }),
  };
}

export function toV1Event(event: EventRow) {
  return {
    ...sharedEventFields(event),
    location: event.location,
    ...(event.meeting_url ? { meetingUrl: event.meeting_url } : {}),
  };
}

export function toV2Event(event: EventRow) {
  return {
    ...sharedEventFields(event),
    location: {
      name: event.location,
      online: event.meeting_url !== null,
      url: event.meeting_url,
    },
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
