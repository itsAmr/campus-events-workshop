import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CampusDatabase } from "../src/db/database.js";
import { seededApp } from "./helpers.js";

describe("Part 2: responses that can grow", () => {
  let db: CampusDatabase;
  let app: Express;

  beforeEach(() => ({ db, app } = seededApp()));
  afterEach(() => db.close());

  const findEvent = async (q: string) =>
    (await request(app).get("/api/v1/events").query({ q }).expect(200)).body.data[0];

  it("2.1 online events include their meetingUrl", async () => {
    const event = await findEvent("AI Ethics");
    expect(event.meetingUrl).toMatch(/^https:/);
  });

  it("2.1 in-person events have meetingUrl: null", async () => {
    const event = await findEvent("Robotics");
    expect(event).toHaveProperty("meetingUrl", null);
  });

  it("keeps every field clients already rely on, with the same name and type", async () => {
    const event = await findEvent("Robotics");
    expect(event).toMatchObject({
      id: expect.any(Number),
      title: expect.any(String),
      description: expect.any(String),
      category: expect.any(String),
      startsAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      endsAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
      location: expect.any(String),
      capacity: expect.any(Number),
      rsvpCount: expect.any(Number),
      availableSpots: expect.any(Number),
    });
  });
});
