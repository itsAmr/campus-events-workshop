import express from "express";
import { createDatabase, type CampusDatabase } from "./db/database.js";
import { errorHandler, notImplemented, unknownRoute } from "./errors.js";
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

  // TODO(part-1.1): list events (worked example).
  //   1. Check the query string:  const filters = eventFilters.parse(request.query);
  //   2. Ask the database:        const events = listEvents(db, filters);
  //   3. Reply:                   response.json({ data: events.map(toEvent) });
  // Try it: http://localhost:3001/api/v1/events?category=Technology
  app.get("/api/v1/events", (request, response) => {
    notImplemented("1.1");
  });

  // TODO(part-1.2): get one event.
  //   Same three steps as 1.1. The id comes from the URL as text, in
  //   request.params.id; turn it into a number with parseId. getEvent in
  //   store.ts finds the event, and replies 404 for you when there isn't one.
  // Try it: http://localhost:3001/api/v1/events/1, then /api/v1/events/999
  app.get("/api/v1/events/:id", (request, response) => {
    notImplemented("1.2");
  });

  // TODO(part-1.3): create an event.
  //   Same three steps, but the new event comes in request.body, and the schema
  //   that checks it is newEvent. Save it with createEvent from store.ts.
  //   A successful create replies with status 201 (Created) instead of the
  //   default 200: response.status(201).json(...)
  // Try it: click "Create event" in the web app, once with a field left empty.
  app.post("/api/v1/events", (request, response) => {
    notImplemented("1.3");
  });

  // TODO(part-1.4): RSVP to an event.
  //   The event id is in the URL, like 1.2. The email is in the body: check it
  //   with rsvpRequest, and pull the email out with  const { email } = ...
  //   rsvp in store.ts saves it, and replies 409 for you when this email already
  //   RSVP'd or the event is full. Reply 201 with the RSVP built by toRsvp.
  // Try it: click RSVP in the web app, then try the full "Tiny Climate Action Workshop".
  app.post("/api/v1/events/:id/rsvps", (request, response) => {
    notImplemented("1.4");
  });

  // TODO(part-1.5): Stretch: update an event.
  //   Like 1.2, plus a body of changed fields checked with eventChanges.
  //   Save them with updateEvent.
  app.patch("/api/v1/events/:id", (request, response) => {
    notImplemented("1.5");
  });

  // TODO(part-1.6): Stretch: delete an event.
  //   Use deleteEvent. There's nothing to send back, so reply 204 (No Content)
  //   with an empty body: response.status(204).end()
  app.delete("/api/v1/events/:id", (request, response) => {
    notImplemented("1.6");
  });

  // TODO(part-1.7): Stretch: cancel an RSVP.
  //   This time the email is in the URL, in request.params.email. Check it with
  //   rsvpRequest like 1.4, cancel with cancelRsvp, then reply 204 like 1.6.
  app.delete("/api/v1/events/:id/rsvps/:email", (request, response) => {
    notImplemented("1.7");
  });

  app.use(unknownRoute);
  app.use(errorHandler);
  return app;
}
