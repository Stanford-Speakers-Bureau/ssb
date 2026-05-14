# SSB — Public Site

Public-facing ticketing and event site for the Stanford Speakers Bureau.
Handles tickets, QR check-in, Apple/Google wallet passes, referrals,
waitlists, suggestions, and transactional email.

Lives alongside [`admin/`](../admin) (the dashboard); the two apps share a
Postgres database and a Stanford-SSO session cookie.

## Stack

- **Next.js 16** (App Router, React 19) on **Cloudflare Workers** via
  [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare)
- **Bun** as package manager / dev runtime
- **Supabase** (Postgres) — accessed in prod through **Cloudflare Hyperdrive**
- **Drizzle ORM** via the local `@ssb/db` package
- **AWS SES** for transactional email (raw MIME, hand-rolled v4 signing — no SDK)
- **Cloudflare Queues** for async email send-out (`ssb-email-jobs`)
- **Cloudflare R2** for the Next incremental cache (`ssb-cache`) and image cache
- **Apple PKPass** (`passkit-generator`) and **Google Wallet** (JWT) passes
- **Stanford SAML SSO** with **first-party iron-session** cookies, shared with `admin/`
- **Upstash Redis** for rate limiting
- **Tailwind v4**

## Layout

```
app/
├── (home)/             marketing pages
├── [eventID]/          per-event ticket flow
├── api/                route handlers
│   ├── auth/           SAML login, callback, metadata, logout
│   ├── tickets/        purchase, cancel, resend, wallet pass
│   ├── scan/           check-in endpoints
│   ├── referrals/      referral capture + leaderboard
│   ├── waitlist/       join/leave waitlist
│   ├── notify/         "notify me" signups
│   ├── feedback/       post-event NPS + comments
│   ├── mailing-lists/  list subscribe/unsubscribe
│   ├── vote/           audience voting
│   ├── suggest/        speaker suggestions
│   ├── images/         R2-backed image proxy
│   └── unsubscribe/    one-click email unsubscribe
├── scan/               admin-facing scanner page
├── account/            user account / past tickets
├── events/             event listings
├── lib/                supabase, auth, email, wallet, ratelimit, …
└── components/         shared UI
packages/db/            @ssb/db — drizzle schema, queries, client (Hyperdrive-aware)
supabase/migrations/    SQL migrations (source of truth for the schema)
public/                 static assets
middleware.ts           CSRF + origin check + body-size guard
worker.js               Cloudflare Worker entry (loaded by wrangler)
wrangler.jsonc          Cloudflare bindings (R2, Queues, Hyperdrive, Images)
```

`@ssb/db` is a local file dep. The `postinstall` script copies
`packages/db/{src,package.json,tsconfig.json}` into `node_modules/@ssb/db/`
so the worker can resolve it.

## Local development

### Prereqs

- [Bun](https://bun.sh)
- [Supabase CLI](https://supabase.com/docs/guides/local-development)
  (`brew install supabase/tap/supabase`)
- `psql` / `pg_dump` for prod-to-local sync (`brew install libpq`)
- Docker (Supabase local runs in containers)

### Setup

```bash
bun install
supabase start            # boots Postgres on :54322, Studio on :54323
# populate .env — ask a maintainer for dev values
bun dev                   # http://localhost:3000
```

Run `admin/` alongside on `:3001` if you need the dashboard.

### Environment

Local dev reads from `.env`. Production reads from `wrangler.jsonc` `vars`
plus Cloudflare secrets (anything sensitive is set with `wrangler secret put`).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection (local Supabase or prod) — used outside the Worker context |
| `SUPABASE_URL` / `SUPABASE_KEY` / `SUPABASE_KEY_PUBLIC` | Supabase REST + storage |
| `NEXT_PUBLIC_BASE_URL` | Canonical site URL (`http://localhost:3000` locally) |
| `SESSION_SECRET` | iron-session signing key — **must match `admin/`** |
| `SESSION_COOKIE_NAME` | Cookie name — **must match `admin/`** |
| `SESSION_COOKIE_DOMAIN` | Leave **unset** on localhost; set to apex domain in prod |
| `SAML_SP_ENTITY_ID` | SAML SP entity ID registered with Stanford SPDB |
| `SP_PUBLIC_CERT` / `SP_PRIVATE_KEY` | SAML SP keypair (PEM) |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SES sender |
| `SES_FROM_EMAIL` | From-address for transactional mail |
| `APPLE_WALLET_KEY` / `APPLE_WALLET_CERT` / `APPLE_WALLET_G4` | PKPass signing chain (base64-PEM) |
| `GOOGLE_WALLET_EMAIL` / `GOOGLE_WALLET_KEY` | Google Wallet service account |

Dev-only toggles:

| Variable | Effect |
| --- | --- |
| `DISABLE_EMAIL=true` | Skip SES sends entirely (logs the payload instead) |
| `LOCAL_EVENTS_ENABLED=true` | Show events that would normally be hidden by visibility rules |
| `LOCAL_TICKETING_ENABLED=true` | Bypass purchase guardrails for testing |

### Sync prod data into your local DB

There's a one-shot script at the repo root that dumps the production tables
and loads them into your local Supabase:

```bash
../sync-prod-to-local.sh
```

It only copies columns that exist in both schemas, so it's safe to run against
a local DB that's mid-migration. Truncates and reloads
`events, tickets, waitlist, suggest, votes, notify, referrals, roles`.

### Migrations

The schema source of truth is `supabase/migrations/*.sql`. To author a new
migration:

```bash
supabase migration new <name>
# edit the generated SQL
supabase db reset                # rebuild local DB from migrations + seed
```

The Drizzle schema in `packages/db/src/schema.ts` is hand-kept in sync with the
SQL. ⚠️ The drizzle schema files in `web/packages/db/` and `admin/packages/db/`
are **separate copies** and have drifted before — when changing one, check the other.

### Stanford SSO locally

Register these endpoints in [Stanford SPDB](https://spdb.stanford.edu/) for
your local SP:

```
http://localhost:3000/api/auth/metadata
http://localhost:3000/api/auth/callback
```

`SESSION_SECRET` and `SESSION_COOKIE_NAME` must be identical to `admin/`'s
values so the cookie is portable across both apps. On localhost leave
`SESSION_COOKIE_DOMAIN` unset — the cookie scopes to `localhost` and works
across `:3000` and `:3001` automatically.

## Deploy

Production runs on Cloudflare Workers (`ssb` worker, deployed from
`wrangler.jsonc`).

```bash
bun run preview     # local Cloudflare preview (miniflare)
bun run deploy      # opennextjs-cloudflare build && deploy
```

`bun run deploy` runs `opennextjs-cloudflare build` which adapts the Next
build into a Worker, then `wrangler deploy`. Secrets are managed with
`wrangler secret put <NAME>`; non-secret config lives in `wrangler.jsonc`
under `vars`.

Bindings (see `wrangler.jsonc`):

- `HYPERDRIVE` — pooled Postgres connection used by `@ssb/db`
- `NEXT_INC_CACHE_R2_BUCKET` → `ssb-cache` (incremental cache)
- `EMAIL_JOBS_QUEUE` → `ssb-email-jobs` (producer); the same worker also
  consumes the queue in batches of 10 with a `ssb-email-jobs-dlq` dead-letter
- `IMAGES` — Cloudflare Images binding for optimization
- `WORKER_SELF_REFERENCE` — required by OpenNext for ISR fetches

## Scripts

```bash
bun dev              # next dev on :3000
bun run build        # next build (TypeScript / lint check)
bun run preview      # build + run Cloudflare worker locally
bun run deploy       # build + deploy to Cloudflare
bun run lint
bun run prettier
bun run u            # bump every dep (npm-check-updates -u && bun install)
bun run seed         # supabase db reset (reseeds local DB)
npx tsc --noEmit     # type-check without the Next/wrangler build pipeline
```

> `next build` requires an active `wrangler login`; for a quick type check,
> use `npx tsc --noEmit` instead.

## Conventions

Code style, naming, and patterns are documented in
[`../admin/AGENTS.md`](../admin/AGENTS.md); this app follows the same
conventions.
