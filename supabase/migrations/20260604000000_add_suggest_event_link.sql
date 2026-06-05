ALTER TABLE "public"."suggest"
  ADD COLUMN IF NOT EXISTS "event_link" text;
