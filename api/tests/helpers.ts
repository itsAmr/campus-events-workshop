import { createApp } from "../src/app.js";
import { createDatabase } from "../src/db/database.js";
import { seedDatabase } from "../src/db/seed.js";

export function seededApp() {
  const db = createDatabase(":memory:");
  seedDatabase(db);
  return { db, app: createApp(db) };
}

export function newEventBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "McGill API Workshop",
    description: "Build a small campus events API.",
    category: "Technology",
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    endsAt: new Date(Date.now() + 90_000_000).toISOString(),
    location: "Trottier 0100",
    capacity: 20,
    ...overrides,
  };
}
