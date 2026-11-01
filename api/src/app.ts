import express from "express";
import { createDatabase, type CampusDatabase } from "./db/database.js";
import { errorHandler, unknownRoute } from "./errors.js";
import { eventChanges, eventFilters, newEvent, parseId, rsvpRequest } from "./events/requests.js";
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

// Every route follows the same three steps:
//   1. check the request with a schema from events/requests.ts
//   2. read or write the database with a function from events/store.ts
//   3. reply with { data: ... } built by a function from events/responses.ts
// Errors thrown in steps 1 and 2 become JSON error replies automatically.

export function createApp(options: { db?: CampusDatabase } = {}) {
  const db = options.db ?? createDatabase();
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_request, response) => {
    response.json({ data: { status: "ok" } });
  });

  app.get("/api/v1/categories", (_request, response) => {
    response.json({ data: listCategories(db) });
  });

  app.get("/api/v1/events", (request, response) => {
    const filters = eventFilters.parse(request.query);
    const events = listEvents(db, filters);
    response.json({ data: events.map(toEvent) });
  });

  app.get("/api/v1/events/:id", (request, response) => {
    const event = getEvent(db, parseId(request.params.id));
    response.json({ data: toEvent(event) });
  });

  app.post("/api/v1/events", (request, response) => {
    const event = createEvent(db, newEvent.parse(request.body));
    response.status(201).json({ data: toEvent(event) });
  });

  app.post("/api/v1/events/:id/rsvps", (request, response) => {
    const { email } = rsvpRequest.parse(request.body);
    const created = rsvp(db, parseId(request.params.id), email);
    response.status(201).json({ data: toRsvp(created) });
  });

  app.patch("/api/v1/events/:id", (request, response) => {
    const event = updateEvent(db, parseId(request.params.id), eventChanges.parse(request.body));
    response.json({ data: toEvent(event) });
  });

  app.delete("/api/v1/events/:id", (request, response) => {
    deleteEvent(db, parseId(request.params.id));
    response.status(204).end();
  });

  app.delete("/api/v1/events/:id/rsvps/:email", (request, response) => {
    const { email } = rsvpRequest.parse({ email: request.params.email });
    cancelRsvp(db, parseId(request.params.id), email);
    response.status(204).end();
  });

  app.use(unknownRoute);
  app.use(errorHandler);
  return app;
}
