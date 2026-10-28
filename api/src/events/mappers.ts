import type { EventRow, RsvpRow } from "./repository.js";

const commonEvent = (event: EventRow) => ({
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
});

export function toV1Event(event: EventRow) {
  return {
    ...commonEvent(event),
    location: event.location,
    ...(event.meeting_url ? { meetingUrl: event.meeting_url } : {}),
  };
}

export function toV2Event(event: EventRow) {
  return {
    ...commonEvent(event),
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
