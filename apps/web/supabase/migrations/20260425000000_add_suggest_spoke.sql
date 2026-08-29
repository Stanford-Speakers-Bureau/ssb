ALTER TABLE "public"."suggest"
  ADD COLUMN IF NOT EXISTS "spoke" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "suggest_spoke_idx" ON "public"."suggest" ("spoke");
