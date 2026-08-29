# SSB — Admin Dashboard

Internal dashboard for the Stanford Speakers Bureau team. Used to manage
events, tickets, attendance, audiences, mailing lists, email campaigns,
referrals, suggestions, post-event feedback, and audit logs.

Companion to the public [`web/`](../web) app — same Postgres database, same
Stanford-SSO session cookie, distinct Cloudflare Worker.

## Stack

- **Next.js 16** (App Router, React 19) on **Cloudflare Workers** via
  [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
- **Bun** as package manager / dev runtime
- **Supabase** (Postgres) via **Cloudflare Hyperdrive** in prod
- **Drizzle ORM** via the local `@ssb/db` package
- **AWS SES** (`@aws-sdk/client-sesv2`) for bulk + transactional email
- **Cloudflare R2** for the Next incremental cache (`ssb-admin-cache`)
- **Stanford SAML SSO** + **iron-session**, role-gated via `public.roles`
- **ECharts** (`echarts-for-react`) for analytics; **jsPDF** for printable reports
- **Tailwind v4** with a dark zinc palette

## Layout

```
app/
├── api/                route handlers
│   ├── auth/           SAML login, callback, metadata, logout
│   ├── events/         CRUD for events
│   ├── tickets/        ticket admin (unscan, type updates, resend, reminders)
│   ├── attendance/     check-in / attendance management
│   ├── audience/       audience definitions used by campaigns
│   ├── campaigns/      email campaign drafts, sends, tracking
│   ├── mailing-lists/  list CRUD + membership
│   ├── waitlist/       waitlist promotion + management
│   ├── referrals/      referral admin
│   ├── suggestions/    speaker suggestions review
│   ├── feedback/       post-event NPS + comments
│   ├── notify/         "notify me" admin
│   ├── audit/          read audit log
│   ├── users/          role management
│   └── email/          one-off SES sends
├── events/             event management UI
├── tickets/            ticket management UI
├── attendance/         door check-in UI
├── check-in/           live check-in screen
├── campaigns/          email campaign builder + send tracking
├── audience/           audience picker / preview
├── mailing-lists/      mailing list admin
├── waitlist/           waitlist promotion UI
├── referrals/          referral analytics
├── suggest/            suggestions queue
├── feedback-analytics/ NPS + feedback dashboards
├── sales/              ticket sales analytics
├── notify-analytics/   notify-me funnel
├── summary/            org-wide summary
├── users/              admin role management
├── audit/              audit log viewer
├── notify/             notify-me admin
└── lib/                auth, email, ses, audit, validation, …
packages/db/            @ssb/db — drizzle schema, queries, client
supabase/migrations/    SQL migrations (shared with web/)
middleware.ts           CSRF + origin check + body-size guard
wrangler.jsonc          Cloudflare bindings (R2, Hyperdrive)
```

`@ssb/db` is a local file dep. The `postinstall` script copies
`packages/db/{src,package.json,tsconfig.json}` into `node_modules/@ssb/db/`
so the worker can resolve it.

## Local development

### Prereqs

- [Bun](https://bun.sh)
- [Supabase CLI](https://supabase.com/docs/guides/local-development) — shared
  with `web/`, you only need to `supabase start` in one of the two repos
- `psql` for the local admin role insert (`brew install libpq`)
- Docker (Supabase local runs in containers)

### Setup

```bash
bun install
# in web/ or admin/: supabase start  (boots Postgres on :54322)
# populate .env — ask a maintainer for dev values
bun dev                   # http://localhost:3001
```

Next picks `:3001` because `web/` already owns `:3000`. The shared session
cookie works across both ports so you can sign in via either app.

### Grant yourself the admin role

The dashboard reads admin grants from `public.roles`. After running
`supabase start`:

```bash
docker exec -it supabase_db_ssb-local psql -U postgres -c \
  "INSERT INTO public.roles (email, roles) VALUES ('you@stanford.edu', 'admin');"
```

Substitute your Stanford email. The same row format is used in prod.

### Environment

Local dev reads from `.env`. Production reads from `wrangler.jsonc` `vars`
plus Cloudflare secrets (`wrangler secret put`).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection (local Supabase or prod) — used outside the Worker context |
| `SUPABASE_URL` / `SUPABASE_KEY` / `SUPABASE_KEY_PUBLIC` | Supabase REST + storage |
| `NEXT_PUBLIC_BASE_URL` | Public site URL (used when generating ticket/wallet links) |
| `NEXT_PUBLIC_ROOT_URL` | Admin site URL (`http://localhost:3001` locally) |
| `BASE_URL` | Same as `NEXT_PUBLIC_ROOT_URL`, used server-side |
| `SESSION_SECRET` | iron-session signing key — **must match `web/`** |
| `SESSION_COOKIE_NAME` | Cookie name — **must match `web/`** |
| `SESSION_COOKIE_DOMAIN` | Leave **unset** on localhost; set to apex domain in prod |
| `SAML_SP_ENTITY_ID` | SAML SP entity ID registered with Stanford SPDB |
| `SP_PUBLIC_CERT` / `SP_PRIVATE_KEY` | SAML SP keypair (PEM) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SES sender |
| `SES_FROM_EMAIL` | From-address for transactional + bulk mail |
| `APPLE_WALLET_KEY` / `APPLE_WALLET_CERT` | PKPass signing (used to regenerate passes from admin) |
| `GOOGLE_WALLET_EMAIL` / `GOOGLE_WALLET_KEY` | Google Wallet service account |

Dev-only toggles:

| Variable | Effect |
| --- | --- |
| `DISABLE_EMAIL=true` | Skip SES sends (logs payload instead). Highly recommended locally so test reminders don't go to real inboxes |
| `LOCAL_EVENTS_ENABLED=true` | Show events that would normally be hidden |
| `LOCAL_TICKETING_ENABLED=true` | Bypass purchase guardrails |

### Sync prod data into your local DB

```bash
../sync-prod-to-local.sh
```

Dumps the prod tables and reloads them into your local Supabase. Only copies
columns that exist in both schemas, so it's safe across in-flight migrations.
Truncates and reloads `events, tickets, waitlist, suggest, votes, notify,
referrals, roles`.

> ⚠️ This wipes the listed tables locally. Don't run it while you have local
> data you care about.

### Migrations

The SQL files in `supabase/migrations/` are the schema source of truth and
are shared with `web/`. To add a migration:

```bash
supabase migration new <name>
# edit the generated SQL
supabase db reset                # rebuild local DB from migrations + seed
```

The Drizzle schema in `packages/db/src/schema.ts` is hand-kept in sync with
the SQL. ⚠️ `web/packages/db/` and `admin/packages/db/` are **separate copies**
of the schema and have drifted before — when changing one, check the other.

### Seed

```bash
bun run seed     # runs seed.ts
```

`seed.ts` uses `@snaplet/seed` + `@snaplet/copycat` to generate a realistic
dev dataset. Re-run after a `supabase db reset`.

### Stanford SSO locally

Register the local SP with [Stanford SPDB](https://spdb.stanford.edu/):

```
http://localhost:3001/api/auth/metadata
http://localhost:3001/api/auth/callback
```

`SESSION_SECRET` and `SESSION_COOKIE_NAME` must be identical to `web/`'s
values so the cookie is portable across both apps. Leave
`SESSION_COOKIE_DOMAIN` unset on localhost so the cookie scopes to
`localhost` and is shared across `:3000` and `:3001`.

## Deploy

Production runs on Cloudflare Workers (`admin` worker).

```bash
bun run preview     # local Cloudflare preview (miniflare)
bun run deploy      # opennextjs-cloudflare build && deploy
```

`bun run deploy` runs `opennextjs-cloudflare build` and `wrangler deploy`.
Secrets are managed with `wrangler secret put <NAME>`; non-secret config
lives in `wrangler.jsonc` under `vars`.

Bindings (see `wrangler.jsonc`):

- `HYPERDRIVE` — pooled Postgres connection used by `@ssb/db`
- `NEXT_INC_CACHE_R2_BUCKET` → `ssb-admin-cache` (incremental cache)
- `IMAGES` — Cloudflare Images binding
- `WORKER_SELF_REFERENCE` — required by OpenNext for ISR fetches

Unlike `web/`, the admin worker does not have its own email-jobs queue;
bulk sends are issued synchronously from API routes (see `app/lib/bulkSend.ts`).

## Scripts

### Testing

```bash
supabase db start
supabase db reset
bun test                    # unit + email snapshots; integration self-skips
bun run test:integration    # real Postgres and RBAC contracts
bun run test:e2e            # Chromium smoke tests on :3101
bun run test:a11y           # axe WCAG A/AA checks
```

The test preload and Playwright server use deterministic fake credentials and
the local Supabase URL. Database factories reject non-local hosts unless an
explicit `I_KNOW_THIS_DB=<host>` override is supplied.

```bash
bun dev              # next dev on :3001
bun run build        # next build (TypeScript / lint check)
bun run preview      # build + run Cloudflare worker locally
bun run deploy       # build + deploy to Cloudflare
bun run seed         # run seed.ts (snaplet)
bun run lint
bun run prettier
bun run u            # bump every dep (npm-check-updates -u && bun install)
npx tsc --noEmit     # type-check without the Next/wrangler build pipeline
```

> `next build` requires an active `wrangler login`; for a quick type check,
> use `npx tsc --noEmit` instead.

## Conventions

See [`AGENTS.md`](./AGENTS.md) for the full coding-style guide — file naming,
import ordering, server/client component patterns, error handling, auth
checks (`verifyAdminRequest`), Pacific-timezone date handling, and the
zinc/dark UI palette.

## Admin ticket API

`PATCH /api/tickets/:id` supports several actions via the `action` field:

| Action | Effect |
| --- | --- |
| `unscan` | Revert a check-in |
| `updateType` | Change ticket type (handles counter increments) |
| `updateScanned` | Manually toggle scanned state |
| `resendEmail` | Re-send the confirmation email |
| `sendDayOfReminder` / `sendDayOfReminders` | Send the day-of reminder to one / all eligible attendees |
| `sendEarlyReminder` / `sendEarlyReminders` | Send the early reminder to one / all eligible attendees |

`POST /api/tickets` handles both create-new and update-existing — if a ticket
already exists for the `(email, event)` pair it's updated in place instead of
creating a duplicate.
