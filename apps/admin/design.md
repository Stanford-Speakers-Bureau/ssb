# SSB Admin — Design System

The single source of truth for the admin UI. The goal is one coherent, clean,
**always-dark** look across every page. When in doubt, copy the patterns below
verbatim — they are extracted from the **Users & permissions** page
(`app/users/AdminUsersClient.tsx`), which is the canonical reference.

Two decisions anchor everything here:

1. **Brand accent = `rose`.** Primary buttons, focus rings, active tabs, the
   sidebar nav active state, links, and selected form controls are all rose.
   Other hues (`emerald`, `amber`, `blue`, `violet`, …) are **semantic data
   colors only** — charts, metric values, and status indicators — never a
   primary action or accent.
2. **Section switching = underline tabs.** The boxed "segmented control" is
   allowed *only* for inline data filters inside a panel (e.g. a chart range
   toggle), never for page-level navigation.

---

## 1. Foundations

### Background & text

| Role | Token |
| --- | --- |
| App background | `bg-zinc-950` |
| Sidebar | `bg-zinc-900` |
| Primary text | `text-white` |
| Secondary text | `text-zinc-400` |
| Muted / helper text | `text-zinc-500` |
| Faint / disabled | `text-zinc-600` |

### Borders & dividers — opacity, never solid zinc

Always use **opacity-based** whites for separation. Do **not** use
`border-zinc-800` / `divide-zinc-800` (the current app-wide drift).

```
border-white/10      divide-white/10      ring-1 ring-inset ring-white/10
```

### Radius scale

| Element | Radius |
| --- | --- |
| Cards / sections / empty states | `rounded-2xl` |
| Inputs, selects, primary/secondary buttons, wells | `rounded-lg` |
| Ghost / icon buttons, dismiss-able chips | `rounded-md` |
| Count pills, status pills, dots, avatars | `rounded-full` |

> Do not use `rounded-xl` for cards — that is the legacy "analytics" radius.

---

## 2. Color roles

### Brand (rose) — interaction only

Rose means "this is the accent / the action / the active thing."

- Primary button background, hover, focus ring
- Active tab underline + active tab count pill
- Focus rings on inputs/selects/textareas
- `accent-rose-500` on checkboxes/radios
- Sidebar nav active item (`bg-rose-500/10 text-rose-400`)

### Semantic data colors — display only

Reserved for charts, metric numbers, status dots, and badges. **Never** use
these for a primary button, focus ring, or active tab.

| Meaning | Color | Example use |
| --- | --- | --- |
| Positive / success / live | `emerald-400/500` | attended, sales up, event live |
| Warning / passive / standby | `amber-400/500` | passives, standby |
| Negative / danger / detractor | `rose-400/500` | no-show, churn, errors |
| Info / neutral metric | `blue-400/500` | averages, counts |
| Categorical extras | `violet / sky / teal / pink -400` | permission dots, multi-series charts |

Rose doubles as both brand and "negative" — that overlap is fine; context makes
it clear.

### Danger actions

Delete / ban / revoke use a **secondary, muted** button by default (text turns
rose on hover). Only use a filled rose button for a dangerous action when it is
the single primary action of a confirm dialog. See Buttons.

---

## 3. Typography

```html
<!-- Page title -->
<h1 class="font-serif text-2xl font-semibold tracking-tight text-balance text-white sm:text-3xl">…</h1>
<!-- Subtitle -->
<p class="mt-2 max-w-prose text-sm text-pretty text-zinc-400">…</p>
```

- Page titles use **`font-serif` + `font-semibold`** — never `font-bold`
  (edit-event/attendance currently use `font-bold`; fix on touch).
- Section heading inside a card: `text-sm font-semibold text-white`.
- Field label / eyebrow: **sentence case**, `text-xs font-medium tracking-wide text-zinc-400`.
  - **Do not** use `uppercase tracking-wider` (the analytics-page habit). The
    only exception is a monospace eyebrow, which may be `uppercase tracking-wide`.
- Any number that can change adds `tabular-nums`.
- Body text is `text-sm` minimum in admin UI; inputs add `max-sm:text-base`.

---

## 4. Surfaces

```html
<!-- Card / section -->
<section class="rounded-2xl border border-white/10 bg-zinc-900/60 p-5 sm:p-6">…</section>

<!-- Inner well (nested group inside a card) -->
<div class="rounded-lg bg-white/5 p-4 ring-1 ring-inset ring-white/10">…</div>

<!-- Empty state -->
<div class="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
  <p class="text-sm font-medium text-zinc-300">No … yet</p>
  <p class="mt-1 text-sm text-zinc-500">Helper line.</p>
</div>

<!-- List (rows) -->
<ul role="list" class="divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/60">
  <li class="flex items-start gap-4 p-4 sm:p-5">…</li>
</ul>
```

Follow the surface hierarchy: whitespace → divider → well → card. Reserve cards
for standalone or interactive content; use wells for nested secondary content.

---

## 5. Buttons

Max **two** sizes per page; **one** filled primary per page (dialogs count as
their own page). Heights stay within ~28–38px.

```html
<!-- Primary (filled rose) -->
<button type="submit"
  class="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 disabled:opacity-50">
  Save
</button>

<!-- Secondary (soft outline) -->
<button type="button"
  class="rounded-lg bg-white/5 px-3 py-2 text-sm font-medium text-zinc-200 ring-1 ring-inset ring-white/10 hover:bg-white/10">
  Cancel
</button>

<!-- Ghost / inline action (smaller; danger = hover:text-rose-400) -->
<button type="button"
  class="rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white">
  Remove
</button>
```

- **No gradient buttons.** Replace `bg-gradient-to-r from-emerald-500 to-teal-500`
  (edit-event, campaigns) with the solid rose primary. `bg-gradient-*` is also
  deprecated Tailwind — if a gradient is ever truly needed, use `bg-linear-*`.
- Always set `type` (`submit` in forms, else `button`).
- Inline form actions (upload, generate, add row) use the **ghost/secondary**
  style at the smaller size — never the same height as the submit button.

---

## 6. Form controls

```html
<!-- Text input -->
<input name="…" type="text"
  class="w-full rounded-lg bg-white/5 px-3 py-2 text-sm text-white ring-1 ring-inset ring-white/10 placeholder:text-zinc-500 focus:outline-2 focus:-outline-offset-1 focus:outline-rose-500 max-sm:text-base" />
```

- Use `ring-1 ring-inset ring-white/10` + `bg-white/5`. **Never**
  `border border-zinc-700/800` and never pair a solid border with a shadow.
- Focus: `focus:outline-2 focus:-outline-offset-1 focus:outline-rose-500`
  (inset offset so the ring doesn't bleed outside).
- Every control has a `name` and a `<label>` (via `id`/`htmlFor`) or `aria-label`.
- Checkboxes/radios: `accent-rose-500`, sized `size-5 sm:size-4`.
- Selects: same input shell + a custom chevron (`inline-grid grid-cols-[1fr_--spacing(8)]`, `appearance-none pr-8`).
- Toggles turn rose when checked.

---

## 7. Tabs (canonical = underline)

```html
<div class="flex flex-wrap gap-x-6 border-b border-white/10">
  <!-- per tab -->
  <button type="button"
    class="-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap
           border-rose-500 text-white">           <!-- active -->
    Label
    <span class="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs tabular-nums text-rose-300">12</span>
  </button>
  <button type="button"
    class="-mb-px flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-medium whitespace-nowrap
           border-transparent text-zinc-400 hover:text-zinc-200">  <!-- idle -->
    Label
    <span class="rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums text-zinc-400">3</span>
  </button>
</div>
```

- **Never** change `font-weight` between states — color + underline only.
- On overflow, scroll horizontally; don't wrap into a second messy row.

### Segmented control — inline data filters ONLY

Permitted for things like a chart range or a list filter *inside* a panel, not
for page sections:

```html
<div class="inline-flex rounded-lg bg-white/5 p-1 ring-1 ring-inset ring-white/10">
  <button type="button" class="rounded-md px-3 py-1.5 text-sm font-medium bg-white/10 text-white">7d</button>
  <button type="button" class="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-200">30d</button>
</div>
```

---

## 8. Badges, chips & pills

```html
<!-- Removable chip (with semantic dot) -->
<span class="inline-flex items-center gap-1.5 rounded-md bg-white/5 py-1 pr-1 pl-2 text-xs ring-1 ring-inset ring-white/10">
  <span aria-hidden="true" class="size-1.5 shrink-0 rounded-full bg-emerald-400"></span>
  <span class="font-medium text-zinc-200">Label</span>
  <span class="text-zinc-500">scope</span>
  <button type="button" aria-label="Remove" class="ml-0.5 flex size-4 items-center justify-center rounded text-zinc-500 hover:bg-white/10 hover:text-rose-400">✕</button>
</span>

<!-- Status pill (tinted, semantic) -->
<span class="rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/25">Live</span>

<!-- Count pill (neutral) -->
<span class="rounded-full bg-white/5 px-2 py-0.5 text-xs tabular-nums text-zinc-400">42</span>
```

Badge/chip dot colors map to the semantic palette (§2).

---

## 9. Alerts

```html
<div class="flex items-start gap-3 rounded-lg bg-rose-500/10 p-3.5 ring-1 ring-inset ring-rose-500/25">
  <p class="flex-1 text-sm text-rose-300">Error message</p>
  <button type="button" aria-label="Dismiss" class="text-rose-400 hover:text-rose-300">✕</button>
</div>
<!-- success: swap rose → emerald -->
```

---

## 10. Tables

Per the table guidelines:

- **No card wrapper** — place the table directly on the page background.
- Horizontal row dividers only (`divide-y divide-white/10`); no vertical lines,
  no outer border.
- Headings are **sentence case**, not uppercase; `whitespace-nowrap` on `<th>`.
- `w-full`; wrap in the two-div `overflow-x-auto` pattern when columns overflow.

This replaces the current analytics-table pattern (card-wrapped, `uppercase
tracking-wider` headers, `border-zinc-800`).

---

## 11. Icons

- Heroicons **micro (16px → `size-4`)** only in admin UI; `size-5` reserved for
  sidebar nav icons. No raw inline SVGs, no decorative colored containers.
- Always `shrink-0` inside flex; align with the label's first line.
- Many pages use hand-rolled 20/24px stroke SVGs — migrate to `size-4` micro on
  touch.

---

## 12. Layout

| Page type | Container |
| --- | --- |
| Forms, lists, CRUD (reading width) | `mx-auto max-w-5xl px-4 py-8 sm:px-6` |
| Data-dense dashboards / analytics | `px-4 sm:px-6 py-8 space-y-6` (full width) |

- Section rhythm: `space-y-6` (dashboards) / `space-y-8` (forms).
- Card padding: `p-5 sm:p-6`.
- Always `antialiased` on root; `isolate` on the main app container.

---

## 13. Quick "drift → fix" cheatsheet

| If you see (legacy drift) | Replace with (canonical) |
| --- | --- |
| `border-zinc-800` / `divide-zinc-700` | `border-white/10` / `divide-white/10` |
| `rounded-xl` on a card | `rounded-2xl` |
| `bg-zinc-900/50` card | `bg-zinc-900/60` |
| `border border-zinc-700 bg-zinc-800` input | `bg-white/5 ring-1 ring-inset ring-white/10` |
| `bg-gradient-to-r from-emerald-500 to-teal-500` button | `bg-rose-500 hover:bg-rose-400` |
| emerald/teal primary button or focus ring | rose |
| segmented control for page sections | underline tabs |
| `uppercase tracking-wider` label | sentence-case `tracking-wide` |
| `font-bold` h1 | `font-semibold` |
| table inside a card with uppercase headers | bare table, sentence-case headers |
| 20/24px stroke icon in admin UI | `size-4` Heroicons micro |

---

# Per-page redesign plan

Effort key: **S** = token swaps only (find/replace borders, radius, accent),
**M** = token swaps + restructure one control group (tabs/inputs), **L** =
meaningful layout rework.

### Reference pages

| Page | State | Work |
| --- | --- | --- |
| `users/AdminUsersClient` | ✅ Canonical | None — this *is* the spec. |
| `events/edit/EditEventClient` | ⚠️ Hybrid | **M** — gradient→solid rose primary; `font-bold`→`font-semibold` h1; `border-zinc-800`→`border-white/10`; bordered inputs→ring inputs; emerald accents/focus→rose (keep emerald only where it's a *status*, e.g. "live"); `border-b-2 border-emerald-500` tabs→rose. |

### Analytics group (emerald + zinc-800 + rounded-xl → canonical)

For **all** of these the recipe is the same — **S/M**:
swap `border-zinc-800`→`border-white/10`, card `rounded-xl`→`rounded-2xl` &
`bg-zinc-900/50`→`/60`, control `rounded-xl`→`rounded-lg`, **emerald primary
actions / focus rings / active states → rose**, inputs → ring style, uppercase
labels → sentence case. Keep emerald/blue/amber/violet **only** inside charts,
metric numbers, and status dots.

| Page | Extra notes | Effort |
| --- | --- | --- |
| `attendance/AttendanceClient` | Segmented filter tabs (All/Loyalists/…) → underline tabs; export buttons → secondary style; metric cards keep semantic value colors. | M |
| `audience/AudienceClient` | Segmented control + bordered inputs → canonical; affiliation badges keep semantic colors as status pills. | M |
| `check-in/CheckInClient` | Segmented control `bg-zinc-950/70 p-1` → inline-filter pattern or underline; chart colors stay semantic. | M |
| `notify-analytics/NotifyAnalyticsClient` | Card/border/accent swaps. | S |
| `notify/AdminNotifyClient` | Card/border/accent swaps; primary "send"→rose. | S |
| `feedback-analytics/FeedbackAnalyticsClient` | Promoter/passive/detractor stay emerald/amber/rose **as data**; surfaces→canonical. | S |
| `summary/SummaryClient` | Multi-color metrics stay semantic; surfaces→canonical. | S |
| `sales/SalesClient` + `TicketSalesGraph` | Graph series → semantic palette; surfaces→canonical. | S |
| `referrals/ReferralLeaderboardClient` | Toggle → canonical toggle (rose checked); surfaces. | S |
| `mailing-lists/MailingListsClient` | Tabs (announce/newsletter/event) → underline; surfaces. | M |
| `waitlist/WaitlistViewerClient` | Surfaces; table → bare sentence-case table. | S |

### Heavy / structural pages

| Page | Work | Effort |
| --- | --- | --- |
| `tickets/TicketManagementClient` (2169 lines) | Largest. Surfaces + accent→rose; bordered inputs→ring; any segmented section nav→underline tabs; tables → bare sentence-case; keep ticket-state colors semantic. Do in sub-sections. | L |
| `event-questions/AdminEventQuestionsClient` (Q&A) | Standardize button shells to canonical; keep **emerald=approve / rose=reject** as semantic *action* tones (acceptable since they map to outcomes); border/radius/label fixes; section nav→underline. | M |
| `suggest/AdminSuggestClient` | Same approach as Q&A (approve/reject action tones kept; shells canonicalized). | M |
| `events/AdminEventsClient` | Event-status colors stay semantic (live=emerald, standby=amber); primary "create event"→rose; surfaces→canonical; h1 `font-bold`→`font-semibold`. | M |
| `campaigns/CampaignsClient` | Gradient→solid rose; `border-zinc-800`→white/10; status badges stay semantic; tables→bare. | M |
| `audit/AuditLogClient` | Already rose-accented — mostly **S**: `border-zinc-800`→white/10, `rounded-xl`→`2xl`, uppercase labels→sentence; action-type badges stay semantic; table→bare. | S |

### Shell

| File | Work | Effort |
| --- | --- | --- |
| `AdminLayoutClient` | Nav active already rose ✅. Audit any `border-zinc-800`→`border-white/10`; ensure nav icons are `size-5`, sentence-case labels. | S |

---

## Suggested rollout order

1. **`edit/EditEventClient`** — it's a named reference; reconciling it locks the spec.
2. **`audit`** — nearly there; quickest full win to validate the swaps.
3. The **S-effort analytics pages** in a batch (notify, summary, sales, feedback, waitlist, referrals, notify-analytics).
4. The **M-effort** pages (attendance, audience, check-in, mailing-lists, events, campaigns, Q&A, suggest).
5. **`tickets`** last, sub-section by sub-section.
6. Re-audit `AdminLayoutClient` borders.
