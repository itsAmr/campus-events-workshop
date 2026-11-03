import type { CampusDatabase } from "../db/database.js";
import { ConflictError, FieldError, NotFoundError } from "../errors.js";
import type { EventChanges, EventFilters, NewEvent } from "./requests.js";

// Everything that reads or writes the database lives here. Values always go in
// as ? parameters so user input can never become part of the SQL itself.

export type EventRow = {
  id: number;
  title: string;
  description: string;
  category: string;
  starts_at: string;
  ends_at: string;
  location: string;
  capacity: number;
  meeting_url: string | null;
  created_at: string;
  updated_at: string;
  rsvp_count: number;
  is_attending?: number;
};

export type RsvpRow = {
  id: number;
  event_id: number;
  email: string;
  created_at: string;
};

const selectEvents = `
  SELECT e.*, (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id) AS rsvp_count
  FROM events e
`;

export function listCategories(db: CampusDatabase): string[] {
  const rows = db
    .prepare("SELECT DISTINCT category FROM events ORDER BY category COLLATE NOCASE")
    .all() as Array<{ category: string }>;
  return rows.map(({ category }) => category);
}

export function listEvents(db: CampusDatabase, filters: EventFilters): EventRow[] {
  const conditions: string[] = [];
  const values: string[] = [];

  if (filters.q) {
    conditions.push("(e.title LIKE ? COLLATE NOCASE OR e.description LIKE ? COLLATE NOCASE)");
    values.push(`%${filters.q}%`, `%${filters.q}%`);
  }
  if (filters.category) {
    conditions.push("e.category = ? COLLATE NOCASE");
    values.push(filters.category);
  }
  if (filters.from) {
    conditions.push("e.starts_at >= ?");
    values.push(filters.from);
  }
  if (filters.to) {
    conditions.push("e.starts_at <= ?");
    values.push(filters.to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const events = db
    .prepare(`${selectEvents} ${where} ORDER BY e.starts_at, e.id`)
    .all(...values) as EventRow[];

  const { email } = filters;
  if (!email) return events;
  return events.map((event) => ({ ...event, is_attending: hasRsvp(db, event.id, email) ? 1 : 0 }));
}

export function getEvent(db: CampusDatabase, id: number): EventRow {
  const event = db.prepare(`${selectEvents} WHERE e.id = ?`).get(id) as EventRow | undefined;
  if (!event) throw new NotFoundError();
  return event;
}

export function createEvent(db: CampusDatabase, input: NewEvent): EventRow {
  const result = db
    .prepare(
      `INSERT INTO events
         (title, description, category, starts_at, ends_at, location, capacity, meeting_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      input.description,
      input.category,
      input.startsAt,
      input.endsAt,
      input.location,
      input.capacity,
      input.meetingUrl ?? null,
    );
  return getEvent(db, Number(result.lastInsertRowid));
}

// Fields left out of the request keep their current value.
export function updateEvent(db: CampusDatabase, id: number, changes: EventChanges): EventRow {
  const current = getEvent(db, id);
  const startsAt = changes.startsAt ?? current.starts_at;
  const endsAt = changes.endsAt ?? current.ends_at;
  if (endsAt <= startsAt) {
    throw new FieldError("endsAt", "Must be after startsAt");
  }
  if (changes.capacity !== undefined && changes.capacity < current.rsvp_count) {
    throw new FieldError("capacity", "Cannot be below the current RSVP count");
  }

  db.prepare(
    `UPDATE events
     SET title = ?, description = ?, category = ?, starts_at = ?, ends_at = ?,
         location = ?, capacity = ?, meeting_url = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ).run(
    changes.title ?? current.title,
    changes.description ?? current.description,
    changes.category ?? current.category,
    startsAt,
    endsAt,
    changes.location ?? current.location,
    changes.capacity ?? current.capacity,
    changes.meetingUrl === undefined ? current.meeting_url : changes.meetingUrl,
    id,
  );
  return getEvent(db, id);
}

export function deleteEvent(db: CampusDatabase, id: number): void {
  const { changes } = db.prepare("DELETE FROM events WHERE id = ?").run(id);
  if (Number(changes) === 0) throw new NotFoundError();
}

function hasRsvp(db: CampusDatabase, eventId: number, email: string): boolean {
  return (
    db
      .prepare("SELECT 1 FROM rsvps WHERE event_id = ? AND email = ? COLLATE NOCASE")
      .get(eventId, email) !== undefined
  );
}

// These checks give friendly errors. The UNIQUE and FOREIGN KEY rules from
// Part 0 still protect the data from anything that skips this code, like
// npm run db:shell.
export function rsvp(db: CampusDatabase, eventId: number, email: string): RsvpRow {
  const event = getEvent(db, eventId);
  if (hasRsvp(db, eventId, email)) {
    throw new ConflictError("ALREADY_RSVPED", "This email has already RSVP'd");
  }
  if (event.rsvp_count >= event.capacity) {
    throw new ConflictError("EVENT_FULL", "This event is at capacity");
  }
  return db
    .prepare("INSERT INTO rsvps (event_id, email) VALUES (?, ?) RETURNING *")
    .get(eventId, email) as RsvpRow;
}

export function cancelRsvp(db: CampusDatabase, eventId: number, email: string): void {
  getEvent(db, eventId);
  const { changes } = db
    .prepare("DELETE FROM rsvps WHERE event_id = ? AND email = ? COLLATE NOCASE")
    .run(eventId, email);
  if (Number(changes) === 0) throw new NotFoundError("RSVP");
}
