export type ErrorCode =
  | "NOT_FOUND"
  | "ALREADY_RSVPED"
  | "EVENT_FULL"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class DomainError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(resource = "Event") {
    super(404, "NOT_FOUND", `${resource} not found`);
  }
}

export class ConflictError extends DomainError {
  constructor(
    code: Extract<ErrorCode, "ALREADY_RSVPED" | "EVENT_FULL">,
    message: string,
  ) {
    super(409, code, message);
  }
}
