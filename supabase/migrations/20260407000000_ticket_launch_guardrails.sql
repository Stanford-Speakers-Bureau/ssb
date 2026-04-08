CREATE INDEX IF NOT EXISTS "events_route_idx"
  ON "public"."events" USING "btree" ("route");

CREATE INDEX IF NOT EXISTS "tickets_event_type_idx"
  ON "public"."tickets" USING "btree" ("event_id", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "tickets_event_email_unique"
  ON "public"."tickets" USING "btree" ("event_id", "email");
