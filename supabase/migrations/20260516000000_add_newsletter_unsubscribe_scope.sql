-- ──────────────────────────────────────────────────────────────────────────
-- Newsletter unsubscribe scope
--
-- Adds a third scope to email_unsubscribes: 'newsletter'. Semantically it
-- sits between 'announce' (opt out of everything promotional) and 'event'
-- (opt out of one event's marketing): newsletter opt-outs only block
-- newsletter sends and leave new-speaker announcements / other promo
-- emails untouched. Hierarchy from broadest to narrowest:
--
--   announce   → blocks all promotional mail (including newsletter)
--   newsletter → blocks newsletter sends only
--   event      → blocks one event's promo
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE "public"."email_unsubscribes"
  DROP CONSTRAINT IF EXISTS email_unsubscribes_scope_check;

ALTER TABLE "public"."email_unsubscribes"
  DROP CONSTRAINT IF EXISTS email_unsubscribes_scope_event_check;

ALTER TABLE "public"."email_unsubscribes"
  ADD CONSTRAINT email_unsubscribes_scope_check
  CHECK ("scope" IN ('announce', 'event', 'newsletter'));

ALTER TABLE "public"."email_unsubscribes"
  ADD CONSTRAINT email_unsubscribes_scope_event_check
  CHECK (
    ("scope" = 'announce' AND "event_id" IS NULL)
    OR ("scope" = 'newsletter' AND "event_id" IS NULL)
    OR ("scope" = 'event' AND "event_id" IS NOT NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS "email_unsubscribes_newsletter_unique"
  ON "public"."email_unsubscribes" ("email")
  WHERE "scope" = 'newsletter';
