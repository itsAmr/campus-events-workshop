import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CampusDatabase } from "../src/db/database.js";
import { newEventBody, seededApp } from "./helpers.js";

describe("Part 1 stretch goals", () => {
  let db: CampusDatabase;
  let app: Express;

  beforeEach(() => ({ db, app } = seededApp()));
  afterEach(() => db.close());

  it("1.5 updates an event", async () => {
    const created = await request(app).post("/api/v1/events").send(newEventBody()).expect(201);
    const updated = await request(app)
      .patch(`/api/v1/events/${created.body.data.id}`)
      .send({ capacity: 30 })
      .expect(200);
    expect(updated.body.data.capacity).toBe(30);
  });

  it("1.6 deletes an event", async () => {
    const created = await request(app).post("/api/v1/events").send(newEventBody()).expect(201);
    await request(app).delete(`/api/v1/events/${created.body.data.id}`).expect(204);
    await request(app).get(`/api/v1/events/${created.body.data.id}`).expect(404);
  });

  it("1.7 cancels an RSVP", async () => {
    const email = "student@mcgill.ca";
    await request(app).post("/api/v1/events/1/rsvps").send({ email }).expect(201);
    await request(app).delete(`/api/v1/events/1/rsvps/${encodeURIComponent(email)}`).expect(204);
    await request(app).post("/api/v1/events/1/rsvps").send({ email }).expect(201);
  });
});
