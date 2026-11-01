import express, { type RequestHandler } from "express";
import { createDatabase, type CampusDatabase } from "./db/database.js";
import { errorHandler, unknownRoute } from "./errors.js";
import {
  eventChanges,
  eventFilters,
  newEvent,
  parse,
  parseId,
  rsvpRequest,
} from "./events/requests.js";
import { toRsvp, toV1Event, toV2Event } from "./events/responses.js";
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

const v1LifecycleHeaders: RequestHandler = (_request, response, next) => {
  response.set("Deprecation", "true");
  response.set("Sunset", "Fri, 31 Dec 2027 23:59:59 GMT");
  next();
};

export function createApp(options: { db?: CampusDatabase } = {}) {
  const db = options.db ?? createDatabase();
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_request, response) => {
    response.json({ data: { status: "ok" } });
  });

  const v1 = express.Router();
  v1.use(v1LifecycleHeaders);

  v1.get("/categories", (_request, response) => {
    response.json({ data: listCategories(db) });
  });

  v1.get("/events", (request, response) => {
    const filters = parse(eventFilters, request.query);
    const events = listEvents(db, filters);
    response.json({ data: events.map(toV1Event) });
  });

  v1.get("/events/:id", (request, response) => {
    const event = getEvent(db, parseId(request.params.id));
    response.json({ data: toV1Event(event) });
  });

  v1.post("/events", (request, response) => {
    const event = createEvent(db, parse(newEvent, request.body));
    response.status(201).json({ data: toV1Event(event) });
  });

  v1.post("/events/:id/rsvps", (request, response) => {
    const { email } = parse(rsvpRequest, request.body);
    const created = rsvp(db, parseId(request.params.id), email);
    response.status(201).json({ data: toRsvp(created) });
  });

  v1.patch("/events/:id", (request, response) => {
    const event = updateEvent(db, parseId(request.params.id), parse(eventChanges, request.body));
    response.json({ data: toV1Event(event) });
  });

  v1.delete("/events/:id", (request, response) => {
    deleteEvent(db, parseId(request.params.id));
    response.status(204).end();
  });

  v1.delete("/events/:id/rsvps/:email", (request, response) => {
    const { email } = parse(rsvpRequest, { email: request.params.email });
    cancelRsvp(db, parseId(request.params.id), email);
    response.status(204).end();
  });

  app.use("/api/v1", v1);

  const v2 = express.Router();

  v2.get("/events", (request, response) => {
    const events = listEvents(db, parse(eventFilters, request.query));
    response.json({ data: events.map(toV2Event) });
  });

  v2.get("/events/:id", (request, response) => {
    const event = getEvent(db, parseId(request.params.id));
    response.json({ data: toV2Event(event) });
  });

  app.use("/api/v2", v2);

  app.use(unknownRoute);
  app.use(errorHandler);
  return app;
}
