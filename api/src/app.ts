import express, {
  type ErrorRequestHandler,
  type RequestHandler,
} from "express";
import { ZodError, type ZodType } from "zod";
import {
  createDatabase,
  type CampusDatabase,
} from "./db/database.js";
import { DomainError } from "./domain/errors.js";
import { toRsvp, toV1Event, toV2Event } from "./events/mappers.js";
import {
  createEventSchema,
  eventFiltersSchema,
  eventIdSchema,
  rsvpSchema,
  updateEventSchema,
} from "./events/schemas.js";
import { EventService } from "./events/service.js";

export type CreateAppOptions = {
  db?: CampusDatabase;
};

function parse<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

const parseId = (value: string): number => parse(eventIdSchema, value);

const v1LifecycleHeaders: RequestHandler = (_request, response, next) => {
  response.set("Deprecation", "true");
  response.set("Sunset", "Fri, 31 Dec 2027 23:59:59 GMT");
  next();
};

export function createApp(options: CreateAppOptions = {}) {
  const db = options.db ?? createDatabase();
  const service = new EventService(db);
  const app = express();
  app.locals.db = db;

  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_request, response) => {
    response.json({ data: { status: "ok" } });
  });

  const v1 = express.Router();
  v1.use(v1LifecycleHeaders);

  v1.get("/categories", (_request, response) => {
    response.json({ data: service.categories() });
  });

  v1.get("/events", (request, response) => {
    const filters = parse(eventFiltersSchema, request.query);
    response.json({
      data: service.list(filters).map((event) => ({
        ...toV1Event(event),
        isAttending: filters.email
          ? service.hasRsvp(event.id, filters.email)
          : false,
      })),
    });
  });

  v1.get("/events/:id", (request, response) => {
    response.json({ data: toV1Event(service.get(parseId(request.params.id))) });
  });

  v1.post("/events", (request, response) => {
    const event = service.create(parse(createEventSchema, request.body));
    response
      .status(201)
      .location(`/api/v1/events/${event.id}`)
      .json({ data: toV1Event(event) });
  });

  v1.patch("/events/:id", (request, response) => {
    const event = service.update(
      parseId(request.params.id),
      parse(updateEventSchema, request.body),
    );
    response.json({ data: toV1Event(event) });
  });

  v1.delete("/events/:id", (request, response) => {
    service.delete(parseId(request.params.id));
    response.status(204).end();
  });

  v1.post("/events/:id/rsvps", (request, response) => {
    const eventId = parseId(request.params.id);
    const { email } = parse(rsvpSchema, request.body);
    const rsvp = service.rsvp(eventId, email);
    response
      .status(201)
      .location(`/api/v1/events/${eventId}/rsvps/${encodeURIComponent(email)}`)
      .json({ data: toRsvp(rsvp) });
  });

  v1.delete("/events/:id/rsvps/:email", (request, response) => {
    const eventId = parseId(request.params.id);
    const { email } = parse(rsvpSchema, {
      email: decodeURIComponent(request.params.email),
    });
    service.cancelRsvp(eventId, email);
    response.status(204).end();
  });

  app.use("/api/v1", v1);
  app.use("/v1", v1);

  const v2 = express.Router();
  v2.get("/events", (_request, response) => {
    response.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Implement the v2 event collection in Part 2",
        details: { sourcePath: "api/src/app.ts" },
      },
    });
  });
  v2.get("/events/:id", (_request, response) => {
    response.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Implement the v2 event detail in Part 2",
        details: { sourcePath: "api/src/app.ts" },
      },
    });
  });
  app.use("/api/v2", v2);
  app.use("/v2", v2);

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  const errorHandler: ErrorRequestHandler = (
    error,
    _request,
    response,
    _next,
  ) => {
    if (error instanceof ZodError) {
      const flattened = error.flatten();
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: {
            fields: flattened.fieldErrors,
            ...(flattened.formErrors.length
              ? { form: flattened.formErrors }
              : {}),
          },
        },
      });
      return;
    }

    if (error instanceof DomainError) {
      response.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      });
      return;
    }

    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body must contain valid JSON",
        },
      });
      return;
    }

    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
  };
  app.use(errorHandler);

  return app;
}
