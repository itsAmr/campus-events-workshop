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

  v1.get("/events", (_request, response) => {
    response.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Implement event listing in Part 1",
        details: { sourcePath: "api/src/app.ts" },
      },
    });
  });

  v1.get("/events/:id", (_request, response) => {
    response.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Implement event detail in Part 1",
        details: { sourcePath: "api/src/app.ts" },
      },
    });
  });

  v1.post("/events", (_request, response) => {
    response.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Implement event creation in Part 1",
        details: { sourcePath: "api/src/app.ts" },
      },
    });
  });

  v1.patch("/events/:id", (_request, response) => {
    response.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Stretch: implement event updates",
        details: { sourcePath: "api/src/app.ts" },
      },
    });
  });

  v1.delete("/events/:id", (_request, response) => {
    response.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Stretch: implement event deletion",
        details: { sourcePath: "api/src/app.ts" },
      },
    });
  });

  v1.post("/events/:id/rsvps", (_request, response) => {
    response.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Implement RSVP creation in Part 1",
        details: { sourcePath: "api/src/app.ts" },
      },
    });
  });

  v1.delete("/events/:id/rsvps/:email", (_request, response) => {
    response.status(501).json({
      error: {
        code: "NOT_IMPLEMENTED",
        message: "Stretch: implement RSVP cancellation",
        details: { sourcePath: "api/src/app.ts" },
      },
    });
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
