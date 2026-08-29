CREATE INDEX IF NOT EXISTS "roles_email_idx"
  ON "public"."roles" ("email");

CREATE INDEX IF NOT EXISTS "tickets_event_lower_trim_email_idx"
  ON "public"."tickets" ("event_id", lower(trim("email")));
