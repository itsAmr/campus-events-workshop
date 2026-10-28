import { createDatabase, defaultDatabasePath } from "./database.js";

const db = createDatabase();
db.close();
console.log(`Migrations applied to ${defaultDatabasePath}`);
