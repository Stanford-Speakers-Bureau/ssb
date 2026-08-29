-- Per-campaign "please cancel" callout. Lets admins drop the same signed
-- cancel-ticket link used in transactional emails into a campaign, either
-- before or after the body. The callout only renders for recipients who hold
-- a ticket to the chosen event, so the signed link can be built per recipient.
ALTER TABLE "public"."email_campaigns"
  ADD COLUMN IF NOT EXISTS "include_cancel_callout" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "cancel_callout_event_id" uuid
    REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD COLUMN IF NOT EXISTS "cancel_callout_position" text NOT NULL DEFAULT 'before'
    CHECK ("cancel_callout_position" IN ('before', 'after'));
