ALTER TABLE "public"."events"
  DROP CONSTRAINT IF EXISTS "events_ticketing_roles_nonempty";

UPDATE "public"."events"
SET "ticketing_roles" = ARRAY['student', 'faculty', 'staff']::text[]
WHERE "ticketing_roles" IS NULL
   OR cardinality("ticketing_roles") = 0;

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_ticketing_roles_nonempty"
  CHECK (cardinality("ticketing_roles") > 0);
