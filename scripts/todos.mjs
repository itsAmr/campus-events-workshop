// Lists every TODO(part-N.M) left in the workshop code, in workshop order.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const folders = ["api/src", "api/migrations", "mcp/src"];
const pattern = /TODO\(part-(\d+)\.(\d+)\):\s*(.*)/;

function* files(folder) {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (/\.(ts|sql)$/.test(entry.name)) yield path;
  }
}

const todos = [];
for (const folder of folders) {
  for (const file of files(join(root, folder))) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const match = line.match(pattern);
        if (!match) return;
        const [, part, step, summary] = match;
        todos.push({ part: Number(part), step: Number(step), summary, where: `${relative(root, file)}:${index + 1}` });
      });
  }
}

if (todos.length === 0) {
  console.log("No TODOs left. Run npm run check:3 to confirm the last part.");
  process.exit(0);
}

todos.sort((a, b) => a.part - b.part || a.step - b.step);
let currentPart;
for (const todo of todos) {
  if (todo.part !== currentPart) {
    currentPart = todo.part;
    console.log(`\nPart ${todo.part}  (check with: npm run check:${todo.part})`);
  }
  console.log(`  ${todo.part}.${todo.step}  ${todo.summary.padEnd(44)} ${todo.where}`);
}
