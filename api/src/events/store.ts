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

const columns: Record<keyof EventChanges, string> = {
  title: "title",
  description: "description",
  category: "category",
  startsAt: "starts_at",
  endsAt: "ends_at",
  location: "location",
  capacity: "capacity",
  meetingUrl: "meeting_url",
};

export function updateEvent(db: CampusDatabase, id: number, changes: EventChanges): EventRow {
  const current = getEvent(db, id);
  if ((changes.endsAt ?? current.ends_at) <= (changes.startsAt ?? current.starts_at)) {
    throw new FieldError("endsAt", "Must be after startsAt");
  }
  if (changes.capacity !== undefined && changes.capacity < current.rsvp_count) {
    throw new FieldError("capacity", "Cannot be below the current RSVP count");
  }

  const entries = Object.entries(changes) as Array<[keyof EventChanges, unknown]>;
  const assignments = entries.map(([field]) => `${columns[field]} = ?`);
  const values = entries.map(([, value]) => (value ?? null) as string | number | null);
  db.prepare(
    `UPDATE events
     SET ${assignments.join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE id = ?`,
  ).run(...values, id);
  return getEvent(db, id);
}

export function deleteEvent(db: CampusDatabase, id: number): void {
  const { changes } = db.prepare("DELETE FROM events WHERE id = ?").run(id);
  if (Number(changes) === 0) throw new NotFoundError();
}

export function hasRsvp(db: CampusDatabase, eventId: number, email: string): boolean {
  return (
    db
      .prepare("SELECT 1 FROM rsvps WHERE event_id = ? AND email = ? COLLATE NOCASE")
      .get(eventId, email) !== undefined
  );
}

// The checks give friendly errors; the UNIQUE and FOREIGN KEY rules from Part 0
// still guarantee correctness if two requests race. The transaction makes the
// capacity check and the insert happen as one step.
export function rsvp(db: CampusDatabase, eventId: number, email: string): RsvpRow {
  db.exec("BEGIN IMMEDIATE");
  try {
    const event = getEvent(db, eventId);
    if (hasRsvp(db, eventId, email)) {
      throw new ConflictError("ALREADY_RSVPED", "This email has already RSVP'd");
    }
    if (event.rsvp_count >= event.capacity) {
      throw new ConflictError("EVENT_FULL", "This event is at capacity");
    }
    const result = db.prepare("INSERT INTO rsvps (event_id, email) VALUES (?, ?)").run(eventId, email);
    const created = db
      .prepare("SELECT * FROM rsvps WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as RsvpRow;
    db.exec("COMMIT");
    return created;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function cancelRsvp(db: CampusDatabase, eventId: number, email: string): void {
  getEvent(db, eventId);
  const { changes } = db
    .prepare("DELETE FROM rsvps WHERE event_id = ? AND email = ? COLLATE NOCASE")
    .run(eventId, email);
  if (Number(changes) === 0) throw new NotFoundError("RSVP");
}
