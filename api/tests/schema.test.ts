import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabase, type CampusDatabase } from "../src/db/database.js";

describe("rsvps table", () => {
  let db: CampusDatabase;
  let eventId: number;

  function addEvent(title: string): number {
    const result = db
      .prepare(
        `INSERT INTO events (title, description, category, starts_at, ends_at, location, capacity)
         VALUES (?, 'Schema test', 'Technology', '2026-11-06T17:00:00.000Z', '2026-11-06T19:00:00.000Z', 'Trottier 0100', 10)`,
      )
      .run(title);
    return Number(result.lastInsertRowid);
  }

  function addRsvp(event: number | null, email: string | null) {
    return db.prepare("INSERT INTO rsvps (event_id, email) VALUES (?, ?)").run(event, email);
  }

  function countRsvps(event: number): number {
    const row = db
      .prepare("SELECT COUNT(*) AS count FROM rsvps WHERE event_id = ?")
      .get(event) as { count: number };
    return Number(row.count);
  }

  beforeEach(() => {
    db = createDatabase(":memory:");
    eventId = addEvent("Schema Test Event");
  });

  afterEach(() => db.close());

  it("exists with id, event_id, email, and created_at columns", () => {
    const columns = (
      db.prepare("PRAGMA table_info(rsvps)").all() as Array<{ name: string }>
    ).map(({ name }) => name);
    expect(columns, "Create the rsvps table in api/migrations/001_init.sql").toEqual(
      expect.arrayContaining(["id", "event_id", "email", "created_at"]),
    );
  });

  it("fills in id and created_at by itself", () => {
    addRsvp(eventId, "martlet@mcgill.ca");
    const row = db.prepare("SELECT id, created_at FROM rsvps").get() as {
      id: number;
      created_at: string;
    };
    expect(row.id).toBeTypeOf("number");
    expect(
      row.created_at,
      "Store created_at in the same UTC format as the events table",
    ).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/);
  });

  it("requires an email", () => {
    expect(() => addRsvp(eventId, null)).toThrow(/constraint failed/);
  });

  it("only accepts RSVPs for events that exist", () => {
    expect(() => addRsvp(999_999, "martlet@mcgill.ca")).toThrow(/FOREIGN KEY/);
  });

  it("rejects a second RSVP from the same email for the same event", () => {
    addRsvp(eventId, "martlet@mcgill.ca");
    expect(() => addRsvp(eventId, "martlet@mcgill.ca")).toThrow(/UNIQUE/);
  });

  it("lets the same email RSVP to different events", () => {
    const otherEventId = addEvent("Another Schema Test Event");
    addRsvp(eventId, "martlet@mcgill.ca");
    expect(() => addRsvp(otherEventId, "martlet@mcgill.ca")).not.toThrow();
  });

  it("removes an event's RSVPs when the event is deleted", () => {
    addRsvp(eventId, "martlet@mcgill.ca");
    db.prepare("DELETE FROM events WHERE id = ?").run(eventId);
    expect(countRsvps(eventId)).toBe(0);
  });
});
