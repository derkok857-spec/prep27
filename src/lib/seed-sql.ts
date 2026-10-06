import { MODULES, TOPICS } from "./curriculum";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** SQL that seeds the static curriculum tables. Kept in sync with schema.sql by `npm run gen:seed`. */
export function seedSql(): string {
  const topics = TOPICS.map((t) => `  (${q(t.id)}, ${q(t.name)}, ${q(t.short)}, ${t.weightMin}, ${t.weightMax}, ${t.sort})`).join(",\n");
  const modules = MODULES.map((m) => `  (${m.id}, ${q(m.topic)}, ${m.lm}, ${q(m.title)})`).join(",\n");
  return [
    "insert into public.topics (id, name, short, weight_min, weight_max, sort) values",
    `${topics}`,
    "on conflict (id) do nothing;",
    "",
    "insert into public.modules (id, topic_id, lm, title) values",
    `${modules}`,
    "on conflict (id) do nothing;",
  ].join("\n");
}

export const SEED_BEGIN = "-- BEGIN SEED";
export const SEED_END = "-- END SEED";

export function withSeed(schema: string): string {
  const a = schema.indexOf(SEED_BEGIN);
  const b = schema.indexOf(SEED_END);
  if (a < 0 || b < a) throw new Error("seed markers not found in schema.sql");
  return `${schema.slice(0, a + SEED_BEGIN.length)}\n${seedSql()}\n${schema.slice(b)}`;
}
