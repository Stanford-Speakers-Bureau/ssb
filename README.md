# Stanford Speakers Bureau

Monorepo for the SSB web platform.

```
apps/web/       stanfordspeakersbureau.com — public site + ticketing (Cloudflare Worker: ssb)
apps/admin/     admin.stanfordspeakersbureau.com — internal admin (Cloudflare Worker: admin)
packages/db/    @ssb/db — shared drizzle schema, queries, and client
supabase/       SQL migrations, seed, local dev config (source of truth for the schema)
```

Both apps are Next.js 16 on Cloudflare Workers via `@opennextjs/cloudflare`,
sharing one Supabase Postgres. See each app's `README.md` for details.

## Quick start

```bash
bun install                # workspace install (root lockfile)
bunx supabase db start     # local Postgres (Docker), run from repo root
bun run seed               # reset local DB from migrations + seed

bun run web dev            # run the public site
bun run admin dev          # run the admin app
```

## Checks

```bash
bun run typecheck          # tsc for both apps
bun run test               # unit tests for both apps
cd apps/web && bun run check-drift   # cross-app signed-link contract
```

Per-app scripts (build, deploy, e2e, integration) live in each app's
`package.json` and run from that app's directory. Deploys are per app:
`cd apps/web && bun run deploy` (and likewise for admin).
