import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import {
  createDatabase,
  type CampusDatabase,
} from "../src/db/database.js";
import { seedDatabase } from "../src/db/seed.js";

describe("Campus Events API", () => {
  let db: CampusDatabase;
  let app: Express;

  beforeEach(() => {
    db = createDatabase(":memory:");
    seedDatabase(db);
    app = createApp({ db });
  });

  afterEach(() => db.close());

  it("serves seeded categories and 25 relative-date events", async () => {
    const categories = await request(app).get("/api/v1/categories").expect(200);
    expect(categories.body.data).toContain("Technology");
    expect(categories.headers.deprecation).toBe("true");
    expect(categories.headers.sunset).toBeTruthy();

    const events = await request(app).get("/api/v1/events").expect(200);
    expect(events.body.data).toHaveLength(25);
    expect(new Date(events.body.data[0].startsAt).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("filters events by search, category, and date range", async () => {
    const search = await request(app)
      .get("/api/v1/events")
      .query({ q: "robotics", category: "engineering" })
      .expect(200);
    expect(search.body.data.map((event: { title: string }) => event.title)).toEqual([
      "McGill Robotics Open House",
    ]);

    const chosen = search.body.data[0];
    const dateRange = await request(app)
      .get("/api/v1/events")
      .query({ from: chosen.startsAt, to: chosen.startsAt })
      .expect(200);
    expect(dateRange.body.data).toHaveLength(1);
  });

  it("returns stable validation and not-found errors", async () => {
    const invalid = await request(app)
      .post("/api/v1/events")
      .send({ title: "" })
      .expect(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    expect(invalid.body.error.details.fields.title).toBeDefined();

    const missing = await request(app).get("/api/v1/events/99999").expect(404);
    expect(missing.body).toEqual({
      error: { code: "NOT_FOUND", message: "Event not found" },
    });
    expect(missing.headers.deprecation).toBe("true");
  });

  it("creates, updates, and deletes an event", async () => {
    const startsAt = new Date(Date.now() + 86_400_000).toISOString();
    const endsAt = new Date(Date.now() + 90_000_000).toISOString();
    const created = await request(app)
      .post("/api/v1/events")
      .send({
        title: "McGill API Workshop",
        description: "Build a small campus events API.",
        category: "Technology",
        startsAt,
        endsAt,
        location: "Online",
        capacity: 20,
        meetingUrl: "https://events.mcgill.ca/meet/api",
      })
      .expect(201);

    expect(created.headers.location).toBe(
      `/api/v1/events/${created.body.data.id}`,
    );
    expect(created.body.data.meetingUrl).toContain("mcgill.ca");

    const updated = await request(app)
      .patch(`/api/v1/events/${created.body.data.id}`)
      .send({ capacity: 30 })
      .expect(200);
    expect(updated.body.data.capacity).toBe(30);

    await request(app)
      .delete(`/api/v1/events/${created.body.data.id}`)
      .expect(204);
    await request(app)
      .get(`/api/v1/events/${created.body.data.id}`)
      .expect(404);
  });

  it("creates and cancels an RSVP", async () => {
    const list = await request(app).get("/api/v1/events").expect(200);
    const eventId = list.body.data[0].id;
    const email = "student@mcgill.ca";

    const created = await request(app)
      .post(`/api/v1/events/${eventId}/rsvps`)
      .send({ email })
      .expect(201);
    expect(created.body.data.email).toBe(email);

    const duplicate = await request(app)
      .post(`/api/v1/events/${eventId}/rsvps`)
      .send({ email: email.toUpperCase() })
      .expect(409);
    expect(duplicate.body.error.code).toBe("ALREADY_RSVPED");

    await request(app)
      .delete(`/api/v1/events/${eventId}/rsvps/${encodeURIComponent(email)}`)
      .expect(204);
    await request(app)
      .post(`/api/v1/events/${eventId}/rsvps`)
      .send({ email })
      .expect(201);
  });

  it("rejects RSVPs when the seeded full event is at capacity", async () => {
    const list = await request(app)
      .get("/api/v1/events")
      .query({ q: "Tiny Climate Action" })
      .expect(200);
    expect(list.body.data[0].availableSpots).toBe(0);

    const response = await request(app)
      .post(`/api/v1/events/${list.body.data[0].id}/rsvps`)
      .send({ email: "late.student@mcgill.ca" })
      .expect(409);
    expect(response.body.error.code).toBe("EVENT_FULL");
  });

  it("keeps v1 location as a string and maps v2 location to an object", async () => {
    const v1 = await request(app)
      .get("/api/v1/events")
      .query({ q: "AI Ethics" })
      .expect(200);
    expect(v1.body.data[0].location).toBe("Online");
    expect(v1.body.data[0].meetingUrl).toMatch(/^https:/);

    const id = v1.body.data[0].id;
    const v2 = await request(app).get(`/api/v2/events/${id}`).expect(200);
    expect(v2.body.data.location).toEqual({
      name: "Online",
      online: true,
      url: expect.stringMatching(/^https:/),
    });
    expect(v2.headers.deprecation).toBeUndefined();
  });

  it("validates query dates and unknown routes with stable envelopes", async () => {
    const invalidDate = await request(app)
      .get("/api/v1/events")
      .query({ from: "tomorrow" })
      .expect(400);
    expect(invalidDate.body.error.code).toBe("VALIDATION_ERROR");

    const route = await request(app).get("/api/nope").expect(404);
    expect(route.body).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });
});
