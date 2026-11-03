import express from "express";
import type { CampusDatabase } from "./db/database.js";
import { errorHandler, notImplemented, unknownRoute } from "./errors.js";
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

  // TODO(part-1.1): list events (worked example).
  //   1. Read the request:   const filters = readFilters(request);
  //   2. Ask the database:   const events = listEvents(db, filters);
  //   3. Reply:              response.json({ data: events.map(toEvent) });
  // Try it: http://localhost:3001/api/v1/events?category=Technology
  app.get("/api/v1/events", (request, response) => {
    notImplemented("1.1");
  });

  // TODO(part-1.2): get one event.
  //   1. Read the id from the URL:   const id = readEventId(request);
  //   2. Ask the database with getEvent. It replies 404 for you when the event
  //      doesn't exist.
  //   3. Reply with { data: ... }, turning the event into JSON with toEvent like 1.1.
  // Try it: http://localhost:3001/api/v1/events/1, then /api/v1/events/999
  app.get("/api/v1/events/:id", (request, response) => {
    notImplemented("1.2");
  });

  // TODO(part-1.3): create an event.
  //   1. Read the new event from the body:   const input = readNewEvent(request);
  //      Bad input stops here with a 400 that explains each field.
  //   2. Save it with createEvent.
  //   3. Reply like 1.2, but with status 201 (Created): response.status(201).json(...)
  // Try it: click "Create event" in the web app, once with a field left empty.
  app.post("/api/v1/events", (request, response) => {
    notImplemented("1.3");
  });

  // TODO(part-1.4): RSVP to an event.
  //   1. Read the event id and the email with readEventId(request) and readEmail(request).
  //   2. Save the RSVP with rsvp. It replies 409 for you when this email already
  //      RSVP'd or the event is full.
  //   3. Reply with status 201, turning the RSVP into JSON with toRsvp.
  // Try it: click RSVP in the web app, then try the full "Tiny Climate Action Workshop".
  app.post("/api/v1/events/:id/rsvps", (request, response) => {
    notImplemented("1.4");
  });

  // TODO(part-1.5): Stretch: update an event.
  //   Read the id and the changes (readEventId, readEventChanges), save them with
  //   updateEvent, and reply like 1.2.
  app.patch("/api/v1/events/:id", (request, response) => {
    notImplemented("1.5");
  });

  // TODO(part-1.6): Stretch: delete an event.
  //   Read the id, delete it with deleteEvent, then reply 204 (No Content) with an
  //   empty body: response.status(204).end();
  app.delete("/api/v1/events/:id", (request, response) => {
    notImplemented("1.6");
  });

  // TODO(part-1.7): Stretch: cancel an RSVP.
  //   Read the id and the email (readEmail finds it in the URL here), cancel with
  //   cancelRsvp, then reply 204 like 1.6.
  app.delete("/api/v1/events/:id/rsvps/:email", (request, response) => {
    notImplemented("1.7");
  });

  app.use(unknownRoute);
  app.use(errorHandler);
  return app;
}
