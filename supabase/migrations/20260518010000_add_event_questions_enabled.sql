-- Per-event toggle for the moderator Q&A feature

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "questions_enabled" boolean NOT NULL DEFAULT false;
