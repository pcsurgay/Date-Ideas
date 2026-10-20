@AGENTS.md

# IdeaBoard (repo: Date-Ideas)

Open source PWA for collecting place and trip ideas with friends. Groups hold
"ideas": links from Google Maps, Apple Maps, TripAdvisor and similar, shown as
tiles that open the source app. Two developers, hobby project, free tiers only.

## Stack

Next.js (App Router, Turbopack), TypeScript, Tailwind, Supabase (Postgres,
Auth, Realtime, row-level security), deployed on Vercel. No UI or state
libraries beyond React.

## Commands

- `npm run dev`: dev server on http://localhost:3000 (needs `.env.local`, see `.env.example`)
- `npm run lint`, `npm test`, `npm run build`: all three must pass before committing; CI runs them
- `npm test` uses Node's built-in test runner on `tests/*.test.ts` (no Jest or Vitest)
- `npx next typegen`: regenerate route types if `PageProps<"/...">` shows a type error

## Layout

- `src/proxy.ts`: session refresh and auth redirect (Next 16 calls middleware "proxy")
- `src/lib/supabase/{client,server,env}.ts`: Supabase clients; create the browser client inside effects or handlers, never at module scope
- `src/lib/links.ts`: pure link helpers (source detection, place-name parsing, host allowlist). Keep it free of framework imports so it stays unit-testable
- `src/app/api/link-preview/route.ts`: server-side link resolver
- `supabase/migrations/`: SQL, applied by hand in the Supabase SQL Editor. Add new numbered files (`0002_...sql`); never edit an applied one

## Rules that matter

- **Security of the link-preview route:** the server fetches user-supplied URLs. Only hosts in `ALLOWED_BASE_HOSTS` may be fetched, and every redirect hop is re-checked. Never loosen this to a pattern like `google.*`; add explicit hosts and a test in `tests/links.test.ts`.
- **Row level security is the access control.** Every new table needs RLS enabled and policies in its migration. Joining a group only happens through `join_group_by_code()`.
- **Login is email + one-time code, not a magic link,** because links open Safari instead of the installed iPhone PWA.
- Never commit `.env.local` or keys. `.env.example` holds placeholders only.
- Next.js here is a newer major version than most training data: check `node_modules/next/dist/docs/` before using framework APIs.

## Conventions

- Client pages that read params use `use(props.params)` with the global `PageProps<"/route">` type.
- Keep components small and in `src/components/`. Tailwind utility classes inline; theme colors come from CSS variables in `globals.css`.
- Commit messages: short imperative summary line, one logical change per commit.
