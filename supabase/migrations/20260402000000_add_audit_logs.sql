CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "action" text NOT NULL,
  "actor" text NOT NULL,
  "source" text NOT NULL,
  "event_id" uuid,
  "event_name" text,
  "target_email" text,
  "metadata" text
);

CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "public"."audit_logs" ("created_at");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "public"."audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_actor_idx" ON "public"."audit_logs" ("actor");
CREATE INDEX IF NOT EXISTS "audit_logs_event_id_idx" ON "public"."audit_logs" ("event_id");
CREATE INDEX IF NOT EXISTS "audit_logs_target_email_idx" ON "public"."audit_logs" ("target_email");
