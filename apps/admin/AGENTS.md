# AGENTS.md - Coding Agent Guidelines

This document provides guidelines for AI coding agents working in this Next.js admin dashboard codebase.

## Project Overview

- **Framework:** Next.js 16 with App Router, React 19
- **Runtime:** Bun (package manager and runtime)
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Cloudflare Workers via OpenNext
- **Styling:** Tailwind CSS 4 with dark theme (zinc color palette)
- **TypeScript:** Strict mode enabled

## Build/Lint/Test Commands

```bash
# Development
bun dev                 # Start development server

# Build
bun run build          # Build production Next.js app
bun run preview        # Build and preview Cloudflare deployment
bun run deploy         # Build and deploy to Cloudflare

# Linting & Formatting
bun run lint           # Run ESLint
bun run prettier       # Format code with Prettier

# Dependencies
bun run u              # Update all dependencies (npm-check-updates)
bun run cf-typegen     # Generate Cloudflare environment types
```

**Note:** This project does not have a test suite configured.

## Project Structure

```
app/
├── api/               # API route handlers (route.ts files)
├── lib/               # Shared utilities, constants, validation
├── [feature]/         # Feature pages with Server + Client components
│   ├── page.tsx       # Server component (data fetching)
│   └── *Client.tsx    # Client component (interactivity)
├── layout.tsx         # Root layout
└── globals.css        # Global styles
```

## Code Style Guidelines

### File Naming Conventions

| Type              | Convention                   | Example                        |
| ----------------- | ---------------------------- | ------------------------------ |
| Pages             | `page.tsx`                   | `app/events/page.tsx`          |
| Layouts           | `layout.tsx`                 | `app/layout.tsx`               |
| API Routes        | `route.ts`                   | `app/api/events/route.ts`      |
| Client Components | PascalCase + `Client` suffix | `AdminEventsClient.tsx`        |
| Utility Modules   | camelCase                    | `validation.ts`, `supabase.ts` |

### Import Organization

Order imports as follows:

1. External packages (React, Next.js, third-party)
2. Internal imports using `@/` path alias
3. Relative imports (sibling files)

```typescript
// External packages
import { NextResponse } from "next/server";
import { useState } from "react";

// Internal imports with @/ alias
import { verifyAdminRequest } from "@/app/lib/supabase";
import { PACIFIC_TIMEZONE } from "@/app/lib/constants";

// Relative imports
import AdminSuggestClient from "./AdminSuggestClient";
```

### Naming Conventions

- **Components:** PascalCase (`AdminEventsClient`, `TicketSalesGraph`)
- **Functions:** camelCase (`verifyAdminRequest`, `isValidUUID`)
- **Event Handlers:** `handle` prefix (`handleSubmit`, `handleDelete`)
- **State Variables:** camelCase (`isLoading`, `formData`)
- **Exported Constants:** SCREAMING_SNAKE_CASE (`PACIFIC_TIMEZONE`, `MAX_CONTENT_LENGTH`)
- **Types/Interfaces:** PascalCase (`Event`, `Suggestion`, `AdminVerificationResult`)
- **Props Types:** PascalCase + `Props` suffix (`AdminEventsClientProps`)

### Type Patterns

Use discriminated unions for result types:

```typescript
type UnauthorizedResult = { authorized: false; error: string };
type AuthorizedResult = { authorized: true; email: string; adminClient: ... };
export type AdminVerificationResult = UnauthorizedResult | AuthorizedResult;
```

Define props types explicitly:

```typescript
type AdminEventsClientProps = {
  initialEvents: Event[];
};

export default function AdminEventsClient({ initialEvents }: AdminEventsClientProps) { ... }
```

### Component Patterns

**Server Components (default):** Fetch data directly, pass to client components

```typescript
export const dynamic = "force-dynamic";

async function getInitialEvents(): Promise<Event[]> {
  const auth = await verifyAdminRequest();
  if (!auth.authorized) return [];
  // ... fetch data
}

export default async function AdminEventsPage() {
  const initialEvents = await getInitialEvents();
  return <AdminEventsClient initialEvents={initialEvents} />;
}
```

**Client Components:** Mark with `"use client"`, handle interactivity

```typescript
"use client";

import { useState } from "react";

export default function AdminEventsClient({ initialEvents }: Props) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  // ... handlers and JSX
}
```

### Error Handling

**API Routes:** Use try-catch with structured JSON responses

```typescript
try {
  const auth = await verifyAdminRequest();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }
  // ... business logic
} catch (error) {
  console.error("Event save error:", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
```

**Client Components:** State-based error handling

```typescript
const [error, setError] = useState<string | null>(null);

try {
  const response = await fetch("/api/events", { ... });
  if (!response.ok) {
    const data = await response.json();
    setError(data.error || "Failed to save event");
    return;
  }
} catch (error) {
  console.error("Failed to save event:", error);
  setError("Failed to save event. Please try again.");
}
```

### API Route Handlers

Use Next.js App Router conventions:

```typescript
export async function GET(req: Request) { ... }
export async function POST(req: Request) { ... }
export async function PATCH(req: Request) { ... }
export async function DELETE(req: Request) { ... }
```

### Authentication Pattern

Always verify admin access using `verifyAdminRequest()`:

```typescript
const auth = await verifyAdminRequest();
if (!auth.authorized) {
  return NextResponse.json({ error: auth.error }, { status: 401 });
}
// TypeScript now knows auth.adminClient exists
const client = auth.adminClient;
```

### Validation

Use centralized validation functions from `app/lib/validation.ts`:

```typescript
import { isValidUUID, isValidEmail, isValidUrl } from "@/app/lib/validation";

if (!isValidUUID(eventId)) {
  return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
}
```

### Styling

Use Tailwind CSS with dark theme (zinc color palette):

```tsx
<div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 hover:border-zinc-700 transition-all">
  <h1 className="text-3xl font-bold text-white font-serif">Title</h1>
  <p className="text-zinc-400">Description text</p>
</div>
```

### Date/Timezone Handling

Use `date-fns-tz` with the Pacific timezone constant:

```typescript
import { fromZonedTime } from "date-fns-tz";
import { PACIFIC_TIMEZONE } from "@/app/lib/constants";

const utcDate = fromZonedTime(localDate, PACIFIC_TIMEZONE);
```

## Security Considerations

- CSRF protection is handled in middleware
- Use `isValidRedirect()` to prevent open redirects
- Always validate input before database operations
- Never expose service role keys to client code
- Content-Security-Policy headers are configured in `next.config.ts`

## Key Files Reference

| File                    | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `app/lib/supabase.ts`   | Supabase client initialization, auth verification |
| `app/lib/validation.ts` | Input validation functions                        |
| `app/lib/constants.ts`  | Shared constants                                  |
| `app/lib/security.ts`   | Security utilities (CSRF, redirects)              |
| `middleware.ts`         | Request middleware (auth, CSRF)                   |
| `next.config.ts`        | Next.js configuration, CSP headers                |
