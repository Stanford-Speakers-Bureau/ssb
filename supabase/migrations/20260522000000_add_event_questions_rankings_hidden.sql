-- Per-event toggle to hide moderator Q&A rankings from the public.
-- When true, the public sees approved questions in a random order with no
-- rank numbers; admins still see votes and rankings.

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "questions_rankings_hidden" boolean NOT NULL DEFAULT false;
