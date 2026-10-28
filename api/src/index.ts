import { createApp } from "./app.js";
import { createDatabase } from "./db/database.js";
import { seedDatabase } from "./db/seed.js";

const port = Number(process.env.PORT ?? 3001);
const db = createDatabase();

if (process.env.SEED_ON_START !== "false") {
  seedDatabase(db);
}

const server = createApp({ db }).listen(port, () => {
  console.log(`Campus Events API listening on http://localhost:${port}`);
});

function shutdown(): void {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
