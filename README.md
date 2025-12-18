# Stanford Speakers Bureau Site
Custom designed ticketing system to allow for referral tracking and more powerful analytics built in.

## Stack
- AWS simple email service
- Hosted on Cloudflare Workers using Open Next
- Cloudflare R2 for image caching
- Supabase Auth + DB
- Upstash Redis for rate limiting

## Development

### Dev Env

for local dev these must be set
```
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_KEY_PUBLIC=
NEXT_PUBLIC_BASE_URL=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
SES_FROM_EMAIL=
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```
additional config options:
```
DISABLE_EMAIL=(setting this to true disabled sending emails while debugging)
LOCAL_EVENTS_ENABLED=(settings this to true shows all events)
```

### Prod Env
these must be set in your ```wrangler.jsonc``` or ```wrangler.toml```
```
SUPABASE_URL
NEXT_PUBLIC_BASE_URL
UPSTASH_REDIS_REST_URL
SES_FROM_EMAIL
AWS_REGION
```

### Authenticating Locally

whitelist:

```
http://localhost:3000/callback/auth*
```

@ https://supabase.com/dashboard/project/qxevtucghgjbewpwntry/auth/url-configuration

## todo:
- apple wallet 
- google wallet
- 