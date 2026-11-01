import { createInterface } from "node:readline";
import { createDatabase, defaultDatabasePath } from "./database.js";

const db = createDatabase();
const shell = createInterface({ input: process.stdin, output: process.stdout, prompt: "sql> " });

console.log(`Connected to ${defaultDatabasePath}`);
console.log("Type one SQL statement and press Enter. Type .exit to quit.");
shell.prompt();

for await (const line of shell) {
  const sql = line.trim();
  if (sql === ".exit") break;
  if (sql) run(sql);
  shell.prompt();
}

shell.close();
db.close();

function run(sql: string): void {
  try {
    const statement = db.prepare(sql);
    if (statement.columns().length > 0) {
      const rows = statement.all();
      if (rows.length > 0) console.table(rows);
      else console.log("(no rows)");
    } else {
      const { changes } = statement.run();
      console.log(`OK, ${changes} row(s) changed`);
    }
  } catch (error) {
    console.log(`Error: ${(error as Error).message}`);
  }
}
