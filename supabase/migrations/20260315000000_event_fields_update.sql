ALTER TABLE "public"."events" DROP COLUMN IF EXISTS "banner";
ALTER TABLE "public"."events" DROP COLUMN IF EXISTS "waitlist";

ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "standby_enabled" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "priority" text;

ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "hide_ticketing_date" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."events" ALTER COLUMN "livestream" DROP DEFAULT;
ALTER TABLE "public"."events" ALTER COLUMN "livestream" TYPE text USING (
  CASE 
    WHEN livestream = true THEN 'https://www.youtube.com/@StanfordSpeakersBureau'
    ELSE NULL
  END
);

ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "referrals_enabled" boolean NOT NULL DEFAULT false;

UPDATE "public"."tickets" SET type = 'STANDBY' WHERE type = 'WAITLIST';

ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "end_time_date" timestamp with time zone;