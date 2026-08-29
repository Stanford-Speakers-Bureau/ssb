-- Reconcile: replace audience_type with audiences JSON column
-- The original 20260409000000 migration created audience_type as text.
-- We now need audiences as a JSON text column storing [{type, eventIds}].
ALTER TABLE "public"."email_campaigns" ADD COLUMN IF NOT EXISTS "audiences" text NOT NULL DEFAULT '[]';

-- Migrate any existing rows
UPDATE "public"."email_campaigns"
SET "audiences" = json_build_array(json_build_object('type', "audience_type", 'eventIds', CASE WHEN "event_id" IS NOT NULL THEN json_build_array("event_id"::text) ELSE '[]'::json END))::text
WHERE "audience_type" IS NOT NULL;

ALTER TABLE "public"."email_campaigns" DROP COLUMN IF EXISTS "audience_type";
