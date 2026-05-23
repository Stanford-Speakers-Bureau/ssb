-- Track monotonic chunk progression for campaign sends.
ALTER TABLE "public"."email_campaigns"
ADD COLUMN IF NOT EXISTS "last_processed_chunk_index" integer NOT NULL DEFAULT -1;
