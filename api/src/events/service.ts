import type { CampusDatabase } from "../db/database.js";
import {
  ConflictError,
  DomainError,
  NotFoundError,
} from "../domain/errors.js";
import {
  EventRepository,
  type EventFilters,
  type EventRow,
  type EventWrite,
  type RsvpRow,
} from "./repository.js";

export class EventService {
  private readonly repository: EventRepository;

  constructor(private readonly db: CampusDatabase) {
    this.repository = new EventRepository(db);
  }

  categories(): string[] {
    return this.repository.categories();
  }

  list(filters: EventFilters): EventRow[] {
    return this.repository.list(filters);
  }

  hasRsvp(eventId: number, email: string): boolean {
    return this.repository.findRsvp(eventId, email) !== undefined;
  }

  get(id: number): EventRow {
    const event = this.repository.findById(id);
    if (!event) throw new NotFoundError();
    return event;
  }

  create(input: EventWrite): EventRow {
    return this.repository.create(input);
  }

  update(id: number, patch: Partial<EventWrite>): EventRow {
    const current = this.get(id);
    const startsAt = patch.startsAt ?? current.starts_at;
    const endsAt = patch.endsAt ?? current.ends_at;
    if (endsAt <= startsAt) {
      throw new DomainError(
        400,
        "VALIDATION_ERROR",
        "Request validation failed",
        { fields: { endsAt: ["Must be after startsAt"] } },
      );
    }
    if (patch.capacity !== undefined && patch.capacity < current.rsvp_count) {
      throw new DomainError(
        400,
        "VALIDATION_ERROR",
        "Request validation failed",
        { fields: { capacity: ["Cannot be below the current RSVP count"] } },
      );
    }
    return this.repository.update(id, patch)!;
  }

  delete(id: number): void {
    if (!this.repository.delete(id)) throw new NotFoundError();
  }

  rsvp(eventId: number, email: string): RsvpRow {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const event = this.repository.findById(eventId);
      if (!event) throw new NotFoundError();
      if (this.repository.findRsvp(eventId, email)) {
        throw new ConflictError(
          "ALREADY_RSVPED",
          "This email has already RSVP'd",
        );
      }
      if (event.rsvp_count >= event.capacity) {
        throw new ConflictError("EVENT_FULL", "This event is at capacity");
      }
      const rsvp = this.repository.createRsvp(eventId, email);
      this.db.exec("COMMIT");
      return rsvp;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  cancelRsvp(eventId: number, email: string): void {
    this.get(eventId);
    if (!this.repository.deleteRsvp(eventId, email)) {
      throw new NotFoundError("RSVP");
    }
  }
}
