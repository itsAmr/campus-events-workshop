import express, { type RequestHandler } from "express";
import { createDatabase, type CampusDatabase } from "./db/database.js";
import { errorHandler, notImplemented, unknownRoute } from "./errors.js";
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

  // TODO(part-1.1): list events (worked example).
  //   1. Check the query string:  const filters = parse(eventFilters, request.query);
  //   2. Ask the database:        const events = listEvents(db, filters);
  //   3. Reply:                   response.json({ data: events.map(toV1Event) });
  // Try it: http://localhost:3001/api/v1/events?category=Technology
  v1.get("/events", (request, response) => {
    notImplemented("1.1");
  });

  // TODO(part-1.2): get one event.
  //   1. Turn the :id from the URL into a number with parseId(request.params.id).
  //   2. Ask the database with getEvent(db, id). It throws a 404 for you when the
  //      event doesn't exist.
  //   3. Reply with { data: toV1Event(event) }.
  // Try it: http://localhost:3001/api/v1/events/1, then /api/v1/events/999
  v1.get("/events/:id", (request, response) => {
    notImplemented("1.2");
  });

  // TODO(part-1.3): create an event.
  //   1. Check the body with parse(newEvent, request.body). Bad input becomes a
  //      400 with a message for each field.
  //   2. Save it with createEvent(db, input).
  //   3. Reply with status 201 (Created): response.status(201).json({ data: toV1Event(event) });
  // Try it: click "Create event" in the web app, once with a field left empty.
  v1.post("/events", (request, response) => {
    notImplemented("1.3");
  });

  // TODO(part-1.4): RSVP to an event.
  //   1. Get the email from the body: const { email } = parse(rsvpRequest, request.body);
  //   2. Save it with rsvp(db, eventId, email). It throws a 409 when this email
  //      already RSVP'd or the event is full.
  //   3. Reply with status 201 and { data: toRsvp(created) }.
  // Try it: click RSVP in the web app, then try the full "Tiny Climate Action Workshop".
  v1.post("/events/:id/rsvps", (request, response) => {
    notImplemented("1.4");
  });

  // TODO(part-1.5): Stretch: update an event.
  //   Use updateEvent(db, id, parse(eventChanges, request.body)) and reply with
  //   { data: toV1Event(event) }.
  v1.patch("/events/:id", (request, response) => {
    notImplemented("1.5");
  });

  // TODO(part-1.6): Stretch: delete an event.
  //   Use deleteEvent(db, id), then reply 204 (No Content): response.status(204).end();
  v1.delete("/events/:id", (request, response) => {
    notImplemented("1.6");
  });

  // TODO(part-1.7): Stretch: cancel an RSVP.
  //   Check the email with parse(rsvpRequest, { email: request.params.email }),
  //   use cancelRsvp(db, id, email), then reply 204.
  v1.delete("/events/:id/rsvps/:email", (request, response) => {
    notImplemented("1.7");
  });

  app.use("/api/v1", v1);

  const v2 = express.Router();

  // TODO(part-2.2): serve v2 events.
  //   Same steps as 1.1 and 1.2, but build each reply with toV2Event instead of
  //   toV1Event. The database and its rules don't change; only the response does.
  // Try it: http://localhost:3001/api/v2/events/1
  v2.get("/events", (request, response) => {
    notImplemented("2.2");
  });

  v2.get("/events/:id", (request, response) => {
    notImplemented("2.2");
  });

  app.use("/api/v2", v2);

  app.use(unknownRoute);
  app.use(errorHandler);
  return app;
}
