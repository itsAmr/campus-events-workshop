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
      if (rows.length > 0) printTable(rows);
      else console.log("(no rows)");
    } else {
      const { changes } = statement.run();
      console.log(`OK, ${changes} row(s) changed`);
    }
  } catch (error) {
    console.log(`Error: ${(error as Error).message}`);
  }
}

function printTable(rows: Record<string, unknown>[]): void {
  const columns = Object.keys(rows[0]!);
  const cells = rows.map((row) => columns.map((column) => String(row[column] ?? "NULL")));
  const widths = columns.map((column, i) =>
    Math.max(column.length, ...cells.map((line) => line[i]!.length)),
  );
  const format = (line: string[]) => line.map((cell, i) => cell.padEnd(widths[i]!)).join(" | ");
  console.log(format(columns));
  console.log(widths.map((width) => "-".repeat(width)).join("-+-"));
  for (const line of cells) console.log(format(line));
}
