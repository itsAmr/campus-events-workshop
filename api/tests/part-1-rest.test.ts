import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CampusDatabase } from "../src/db/database.js";
import { newEventBody, seededApp } from "./helpers.js";

describe("Part 1: REST API", () => {
  let db: CampusDatabase;
  let app: Express;

  beforeEach(() => ({ db, app } = seededApp()));
  afterEach(() => db.close());

  it("1.1 lists the 25 seeded events, soonest first", async () => {
    const response = await request(app).get("/api/v1/events").expect(200);
    const events = response.body.data;
    expect(events).toHaveLength(25);
    expect(events[0].startsAt <= events[1].startsAt).toBe(true);
    expect(events[0]).toMatchObject({ id: expect.any(Number), title: expect.any(String) });
  });

  it("1.1 filters by search text, category, and date range", async () => {
    const search = await request(app)
      .get("/api/v1/events")
      .query({ q: "robotics", category: "engineering" })
      .expect(200);
    expect(search.body.data.map((event: { title: string }) => event.title)).toEqual([
      "McGill Robotics Open House",
    ]);

    const { startsAt } = search.body.data[0];
    const range = await request(app).get("/api/v1/events").query({ from: startsAt, to: startsAt }).expect(200);
    expect(range.body.data).toHaveLength(1);

    const badDate = await request(app).get("/api/v1/events").query({ from: "tomorrow" }).expect(400);
    expect(badDate.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("1.1 marks the events an email is attending", async () => {
    const response = await request(app)
      .get("/api/v1/events")
      .query({ q: "Tiny Climate", email: "martlet@mcgill.ca" })
      .expect(200);
    expect(response.body.data[0].isAttending).toBe(true);
  });

  it("1.2 gets one event, or a 404 for an id that doesn't exist", async () => {
    const found = await request(app).get("/api/v1/events/1").expect(200);
    expect(found.body.data.id).toBe(1);

    const missing = await request(app).get("/api/v1/events/99999").expect(404);
    expect(missing.body).toEqual({ error: { code: "NOT_FOUND", message: "Event not found" } });

    await request(app).get("/api/v1/events/abc").expect(400);
  });

  it("1.3 creates an event and replies 201 with the saved event", async () => {
    const created = await request(app).post("/api/v1/events").send(newEventBody()).expect(201);
    expect(created.body.data).toMatchObject({ id: expect.any(Number), title: "McGill API Workshop" });

    const list = await request(app).get("/api/v1/events").query({ q: "McGill API Workshop" }).expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it("1.3 rejects an invalid event with a message for each bad field", async () => {
    const invalid = await request(app).post("/api/v1/events").send({ title: "" }).expect(400);
    expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(invalid.body.error.details.fields)).toEqual(
      expect.arrayContaining(["title", "startsAt", "location"]),
    );
  });

  it("1.4 RSVPs once, then rejects the same email with 409", async () => {
    const email = "student@mcgill.ca";
    const created = await request(app).post("/api/v1/events/1/rsvps").send({ email }).expect(201);
    expect(created.body.data).toMatchObject({ eventId: 1, email });

    const duplicate = await request(app)
      .post("/api/v1/events/1/rsvps")
      .send({ email: email.toUpperCase() })
      .expect(409);
    expect(duplicate.body.error.code).toBe("ALREADY_RSVPED");
  });

  it("1.4 rejects an RSVP when the event is full", async () => {
    const list = await request(app).get("/api/v1/events").query({ q: "Tiny Climate" }).expect(200);
    const full = list.body.data[0];
    expect(full.availableSpots).toBe(0);

    const response = await request(app)
      .post(`/api/v1/events/${full.id}/rsvps`)
      .send({ email: "late.student@mcgill.ca" })
      .expect(409);
    expect(response.body.error.code).toBe("EVENT_FULL");
  });

  it("replies to unknown routes with a JSON 404", async () => {
    const response = await request(app).get("/api/nope").expect(404);
    expect(response.body).toEqual({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });
});
