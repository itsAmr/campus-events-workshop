import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const dbDirectory = dirname(fileURLToPath(import.meta.url));
export const migrationsDirectory = resolve(dbDirectory, "../../migrations");
export const defaultDatabasePath =
  process.env.DATABASE_PATH ?? resolve(dbDirectory, "../../data/campus-events.db");

export type CampusDatabase = DatabaseSync;

export function openDatabase(filename = defaultDatabasePath): CampusDatabase {
  if (filename !== ":memory:") {
    mkdirSync(dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

export function runMigrations(
  db: CampusDatabase,
  directory = migrationsDirectory,
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `);

  const applied = db.prepare("SELECT name FROM schema_migrations").all() as Array<{
    name: string;
  }>;
  const appliedNames = new Set(applied.map(({ name }) => name));
  const migrationFiles = readdirSync(directory)
    .filter((name) => /^\d+.*\.sql$/.test(name))
    .sort();
  const recordMigration = db.prepare(
    "INSERT INTO schema_migrations (name) VALUES (?)",
  );

  for (const name of migrationFiles) {
    if (appliedNames.has(name)) continue;

    const sql = readFileSync(join(directory, name), "utf8");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      recordMigration.run(name);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Migration ${name} failed`, { cause: error });
    }
  }
}

export function createDatabase(filename = defaultDatabasePath): CampusDatabase {
  const db = openDatabase(filename);
  runMigrations(db);
  return db;
}
