<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Prep27 notes for agents

- Study logic lives in `src/lib` as pure functions. Keep it free of React and Supabase and cover changes with tests in `tests/unit`.
- The UI is client side only. `src/components/ClientShell.tsx` loads the app shell with `ssr: false` because it needs localStorage, the auth session and the local date.
- Storage goes through the `Repo` interface (`src/lib/repo/types.ts`). Cloud mode uses Supabase with row level security, demo mode uses localStorage seeded by `src/lib/repo/demo.ts`. Keep both in step.
- Database changes go in `supabase/schema.sql` and need a test in `tests/sql/schema.test.ts`. The seed block is generated, run `npm run gen:seed` after editing `src/lib/curriculum.ts`.
- The worker API (`src/app/api/worker/*`) only uses `src/lib/worker/handlers.ts`, which stays free of Next.js imports so it can be tested directly. Writes go through the `worker_insert_batch` SQL function.
- Never commit secrets, curriculum text or official questions. Module titles from the public topic outline are fine.
- Before finishing run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:e2e` for UI changes.
