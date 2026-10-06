// Rewrites the seed block at the end of supabase/schema.sql from src/lib/curriculum.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { withSeed } from "../src/lib/seed-sql";

const file = fileURLToPath(new URL("../supabase/schema.sql", import.meta.url));
const before = readFileSync(file, "utf8");
const after = withSeed(before);
if (after !== before) {
  writeFileSync(file, after);
  console.log("schema.sql seed updated");
} else {
  console.log("schema.sql seed already up to date");
}
