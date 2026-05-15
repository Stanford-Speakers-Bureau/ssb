-- Adds a banner_eligible flag to events. When false, the event is hidden
-- from the top site banner and event popup entirely — used to suppress
-- events we don't want to promote site-wide while still keeping their
-- public event page reachable.
ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "banner_eligible" boolean NOT NULL DEFAULT true;
