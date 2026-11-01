import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CampusDatabase } from "../src/db/database.js";
import { toV2Event } from "../src/events/responses.js";
import { getEvent, listEvents } from "../src/events/store.js";
import { seededApp } from "./helpers.js";

describe("Part 2: versioning", () => {
  let db: CampusDatabase;
  let app: Express;

  beforeEach(() => ({ db, app } = seededApp()));
  afterEach(() => db.close());

  const findEvent = (q: string) => listEvents(db, { q })[0]!;

  it("2.1 toV2Event turns an online event's location into { name, online, url }", () => {
    const event = toV2Event(findEvent("AI Ethics"));
    expect(event.location).toEqual({
      name: "Online",
      online: true,
      url: expect.stringMatching(/^https:/),
    });
  });

  it("2.1 toV2Event marks an in-person event as not online", () => {
    const event = toV2Event(findEvent("Robotics"));
    expect(event.location).toEqual({ name: "McConnell Engineering 204", online: false, url: null });
  });

  it("2.1 toV2Event keeps every other field the same as v1", () => {
    const { location, ...rest } = toV2Event(getEvent(db, 1));
    expect(rest).toMatchObject({ id: 1, title: expect.any(String), startsAt: expect.any(String) });
    expect(rest).not.toHaveProperty("meetingUrl");
  });

  it("2.2 serves the v2 list and detail routes", async () => {
    const list = await request(app).get("/api/v2/events").query({ category: "Technology" }).expect(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    expect(list.body.data[0].location).toHaveProperty("online");

    const detail = await request(app).get("/api/v2/events/1").expect(200);
    expect(detail.body.data.location).toHaveProperty("name");
    expect(detail.headers.deprecation).toBeUndefined();
  });

  it("keeps v1 unchanged and marks it deprecated", async () => {
    const v1 = await request(app).get("/api/v1/events").query({ q: "AI Ethics" }).expect(200);
    expect(v1.body.data[0].location).toBe("Online");
    expect(v1.body.data[0].meetingUrl).toMatch(/^https:/);
    expect(v1.headers.deprecation).toBe("true");
    expect(v1.headers.sunset).toBeTruthy();
  });
});
