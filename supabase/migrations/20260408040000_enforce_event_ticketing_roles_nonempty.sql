ALTER TABLE "public"."events"
  DROP CONSTRAINT IF EXISTS "events_ticketing_roles_nonempty";

ALTER TABLE "public"."events"
  ADD CONSTRAINT "events_ticketing_roles_nonempty"
  CHECK (cardinality("ticketing_roles") > 0);
