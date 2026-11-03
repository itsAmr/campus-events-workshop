import type { ErrorRequestHandler, RequestHandler } from "express";
import { z, ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = "Event") {
    super(404, "NOT_FOUND", `${resource} not found`);
  }
}

export class ConflictError extends ApiError {
  constructor(code: "ALREADY_RSVPED" | "EVENT_FULL", message: string) {
    super(409, code, message);
  }
}

export class FieldError extends ApiError {
  constructor(field: string, message: string) {
    super(400, "VALIDATION_ERROR", "Request validation failed", {
      fields: { [field]: [message] },
    });
  }
}

// Unfinished starter TODOs call this, so the browser shows which TODO to open.
export function notImplemented(todo: string, file = "api/src/app.ts"): never {
  throw new ApiError(501, "NOT_IMPLEMENTED", `Finish TODO(part-${todo})`, { sourcePath: file });
}

export const unknownRoute: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: { code: "NOT_FOUND", message: "Route not found" },
  });
};

// Every error leaves the API in the same { error: { code, message, details } } shape.
export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    const { fieldErrors, formErrors } = z.flattenError(error);
    response.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: { fields: fieldErrors, ...(formErrors.length ? { form: formErrors } : {}) },
      },
    });
    return;
  }

  if (error instanceof ApiError) {
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
      error: { code: "VALIDATION_ERROR", message: "Request body must contain valid JSON" },
    });
    return;
  }

  // A bug, not bad input: print it so it shows up in the npm run dev output.
  console.error(error);
  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred. Check the api lines in the terminal." },
  });
};
