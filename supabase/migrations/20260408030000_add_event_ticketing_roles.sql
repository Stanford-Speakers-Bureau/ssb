ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "ticketing_roles" text[];

UPDATE "public"."events"
SET "ticketing_roles" = ARRAY['student', 'faculty', 'staff']::text[]
WHERE "ticketing_roles" IS NULL
   OR cardinality("ticketing_roles") = 0;

ALTER TABLE "public"."events"
  ALTER COLUMN "ticketing_roles" SET DEFAULT ARRAY['student', 'faculty', 'staff']::text[];

ALTER TABLE "public"."events"
  ALTER COLUMN "ticketing_roles" SET NOT NULL;
