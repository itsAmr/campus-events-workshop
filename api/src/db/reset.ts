import {
  defaultDatabasePath,
  openDatabase,
  runMigrations,
} from "./database.js";
import { seedDatabase } from "./seed.js";

const db = openDatabase();
db.exec(`
  DROP TABLE IF EXISTS rsvps;
  DROP TABLE IF EXISTS events;
  DROP TABLE IF EXISTS schema_migrations;
`);
runMigrations(db);
seedDatabase(db);
db.close();

console.log(`Reset and seeded ${defaultDatabasePath}`);
