import express from "express";
import type { CampusDatabase } from "./db/database.js";
import { errorHandler, unknownRoute } from "./errors.js";
import {
  readEmail,
  readEventChanges,
  readEventId,
  readFilters,
  readNewEvent,
} from "./events/requests.js";
import { toEvent, toRsvp } from "./events/responses.js";
import {
  cancelRsvp,
  createEvent,
  deleteEvent,
  getEvent,
  listCategories,
  listEvents,
  rsvp,
  updateEvent,
} from "./events/store.js";

// Every events route follows the same three steps:
//   1. read the request with a read function from events/requests.ts, which
//      checks it and stops bad input with a 400
//   2. read or write the database with a function from events/store.ts
//   3. reply with { data: ... } built by a function from events/responses.ts
// Errors thrown in steps 1 and 2 become JSON error replies automatically.

export function createApp(db: CampusDatabase) {
  const app = express();
  app.use(express.json());

  app.get("/health", (_request, response) => {
    response.json({ data: { status: "ok" } });
  });

  app.get("/api/v1/categories", (_request, response) => {
    response.json({ data: listCategories(db) });
  });

  app.get("/api/v1/events", (request, response) => {
    const filters = readFilters(request);
    const events = listEvents(db, filters);
    response.json({ data: events.map(toEvent) });
  });

  app.get("/api/v1/events/:id", (request, response) => {
    const event = getEvent(db, readEventId(request));
    response.json({ data: toEvent(event) });
  });

  app.post("/api/v1/events", (request, response) => {
    const event = createEvent(db, readNewEvent(request));
    response.status(201).json({ data: toEvent(event) });
  });

  app.post("/api/v1/events/:id/rsvps", (request, response) => {
    const created = rsvp(db, readEventId(request), readEmail(request));
    response.status(201).json({ data: toRsvp(created) });
  });

  app.patch("/api/v1/events/:id", (request, response) => {
    const event = updateEvent(db, readEventId(request), readEventChanges(request));
    response.json({ data: toEvent(event) });
  });

  app.delete("/api/v1/events/:id", (request, response) => {
    deleteEvent(db, readEventId(request));
    response.status(204).end();
  });

  app.delete("/api/v1/events/:id/rsvps/:email", (request, response) => {
    cancelRsvp(db, readEventId(request), readEmail(request));
    response.status(204).end();
  });

  app.use(unknownRoute);
  app.use(errorHandler);
  return app;
}
