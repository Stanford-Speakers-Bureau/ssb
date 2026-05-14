-- Per-campaign footer type. Lets admins choose whether a given campaign
-- shows an event-scope unsubscribe link, an announce-scope link, an
-- "event-essential" notice (no unsubscribe), or no footer extra at all.
ALTER TABLE "public"."email_campaigns"
  ADD COLUMN IF NOT EXISTS "footer_type" text NOT NULL DEFAULT 'event_unsubscribe'
    CHECK ("footer_type" IN (
      'event_unsubscribe',
      'announce_unsubscribe',
      'essential',
      'none'
    ));

-- Backfill existing rows: pick the natural default based on whether the
-- campaign is event-bound or not. Anything event-bound gets the event
-- unsubscribe footer; anything else gets the announce unsubscribe footer.
UPDATE "public"."email_campaigns"
SET "footer_type" = CASE
  WHEN "event_id" IS NOT NULL THEN 'event_unsubscribe'
  ELSE 'announce_unsubscribe'
END
WHERE "footer_type" = 'event_unsubscribe';
