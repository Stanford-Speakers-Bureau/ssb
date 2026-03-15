ALTER TABLE "public"."events" DROP COLUMN IF EXISTS "banner";

ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "waitlist" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "priority" text;

ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "hide_ticketing_date" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."events" ALTER COLUMN "livestream" DROP DEFAULT;
ALTER TABLE "public"."events" ALTER COLUMN "livestream" TYPE text USING NULL;
