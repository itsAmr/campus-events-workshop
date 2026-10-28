import type { CampusDatabase } from "../db/database.js";

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
};

export type RsvpRow = {
  id: number;
  event_id: number;
  email: string;
  created_at: string;
};

export type EventWrite = {
  title: string;
  description: string;
  category: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacity: number;
  meetingUrl?: string | null;
};

export type EventFilters = {
  q?: string;
  category?: string;
  from?: string;
  to?: string;
};

const eventSelect = `
  SELECT e.*,
    (SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id) AS rsvp_count
  FROM events e
`;

export class EventRepository {
  constructor(private readonly db: CampusDatabase) {}

  categories(): string[] {
    return (
      this.db
        .prepare("SELECT DISTINCT category FROM events ORDER BY category COLLATE NOCASE")
        .all() as Array<{ category: string }>
    ).map(({ category }) => category);
  }

  list(filters: EventFilters): EventRow[] {
    const clauses: string[] = [];
    const values: string[] = [];

    if (filters.q) {
      clauses.push("(e.title LIKE ? COLLATE NOCASE OR e.description LIKE ? COLLATE NOCASE)");
      values.push(`%${filters.q}%`, `%${filters.q}%`);
    }
    if (filters.category) {
      clauses.push("e.category = ? COLLATE NOCASE");
      values.push(filters.category);
    }
    if (filters.from) {
      clauses.push("e.starts_at >= ?");
      values.push(filters.from);
    }
    if (filters.to) {
      clauses.push("e.starts_at <= ?");
      values.push(filters.to);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return this.db
      .prepare(`${eventSelect} ${where} ORDER BY e.starts_at, e.id`)
      .all(...values) as EventRow[];
  }

  findById(id: number): EventRow | undefined {
    return this.db
      .prepare(`${eventSelect} WHERE e.id = ?`)
      .get(id) as EventRow | undefined;
  }

  create(input: EventWrite): EventRow {
    const result = this.db
      .prepare(`
        INSERT INTO events
          (title, description, category, starts_at, ends_at, location, capacity, meeting_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
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
    return this.findById(Number(result.lastInsertRowid))!;
  }

  update(id: number, patch: Partial<EventWrite>): EventRow | undefined {
    const columns: Record<keyof EventWrite, string> = {
      title: "title",
      description: "description",
      category: "category",
      startsAt: "starts_at",
      endsAt: "ends_at",
      location: "location",
      capacity: "capacity",
      meetingUrl: "meeting_url",
    };
    const entries = Object.entries(patch) as Array<
      [keyof EventWrite, EventWrite[keyof EventWrite]]
    >;
    if (!entries.length) return this.findById(id);

    const assignments = entries.map(([key]) => `${columns[key]} = ?`);
    const values = entries.map(([, value]) => value ?? null);
    this.db
      .prepare(`
        UPDATE events
        SET ${assignments.join(", ")},
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ?
      `)
      .run(...values, id);
    return this.findById(id);
  }

  delete(id: number): boolean {
    return Number(this.db.prepare("DELETE FROM events WHERE id = ?").run(id).changes) > 0;
  }

  findRsvp(eventId: number, email: string): RsvpRow | undefined {
    return this.db
      .prepare("SELECT * FROM rsvps WHERE event_id = ? AND email = ? COLLATE NOCASE")
      .get(eventId, email) as RsvpRow | undefined;
  }

  createRsvp(eventId: number, email: string): RsvpRow {
    const result = this.db
      .prepare("INSERT INTO rsvps (event_id, email) VALUES (?, ?)")
      .run(eventId, email);
    return this.db
      .prepare("SELECT * FROM rsvps WHERE id = ?")
      .get(Number(result.lastInsertRowid)) as RsvpRow;
  }

  deleteRsvp(eventId: number, email: string): boolean {
    return (
      Number(
        this.db
          .prepare("DELETE FROM rsvps WHERE event_id = ? AND email = ? COLLATE NOCASE")
          .run(eventId, email).changes,
      ) > 0
    );
  }
}
