# Stanford Speakers Bureau Site

Custom designed ticketing system to allow for referral tracking and more powerful analytics built in.


## Stack

- AWS simple email service
- Hosted on Cloudflare Workers using Open Next
- Cloudflare R2 for image caching
- Stanford SSO + first-party sessions
- Supabase DB + storage
- Upstash Redis for rate limiting

## Development

### Dev Env

for local dev these must be set

```
SUPABASE_URL
SUPABASE_KEY
SUPABASE_KEY_PUBLIC
NEXT_PUBLIC_BASE_URL
SESSION_SECRET
SESSION_COOKIE_NAME
SESSION_COOKIE_DOMAIN
SAML_SP_ENTITY_ID
SP_PRIVATE_KEY
SP_PUBLIC_CERT
UPSTASH_REDIS_REST_URL
SES_FROM_EMAIL
UPSTASH_REDIS_REST_TOKEN
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
APPLE_WALLET_KEY
APPLE_WALLET_CERT
APPLE_WALLET_G4
GOOGLE_WALLET_EMAIL
GOOGLE_WALLET_KEY
```

additional config options:

```
DISABLE_EMAIL=(setting this to true disabled sending emails while debugging)
LOCAL_EVENTS_ENABLED=(settings this to true shows all events)
```

### Prod Env

these must be set in your `wrangler.jsonc` or `wrangler.toml`

```
SUPABASE_URL
NEXT_PUBLIC_BASE_URL
SESSION_SECRET
SESSION_COOKIE_NAME
SESSION_COOKIE_DOMAIN
SAML_SP_ENTITY_ID
SP_PRIVATE_KEY
SP_PUBLIC_CERT
UPSTASH_REDIS_REST_URL
SES_FROM_EMAIL
AWS_REGION
```

### Setting up local supabase

### Authenticating Locally

Stanford SPDB should allow the local web app service provider metadata and callback:

```
http://localhost:3000/api/auth/metadata
http://localhost:3000/api/auth/callback
```

Use the same `SESSION_SECRET` and `SESSION_COOKIE_NAME` in `web` and `admin`.
On localhost, leave `SESSION_COOKIE_DOMAIN` unset so the shared `localhost` cookie
works across ports.
