-- Event feedback collection plus campaign feedback prompt metadata

CREATE TABLE IF NOT EXISTS "public"."event_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "event_id" uuid NOT NULL REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ticket_id" uuid NOT NULL REFERENCES "public"."tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "email" text NOT NULL,
  "score" integer NOT NULL CHECK ("score" >= 1 AND "score" <= 10),
  "comment" text,
  "submitted_via" text NOT NULL DEFAULT 'event_page'
);

ALTER TABLE "public"."event_feedback" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."event_feedback" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."event_feedback" FROM "anon";
REVOKE ALL ON TABLE "public"."event_feedback" FROM "authenticated";

GRANT ALL ON TABLE "public"."event_feedback" TO "service_role";

DROP POLICY IF EXISTS "service_role_can_manage_event_feedback" ON "public"."event_feedback";

CREATE POLICY "service_role_can_manage_event_feedback"
ON "public"."event_feedback"
FOR ALL
TO "service_role"
USING (true)
WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS "event_feedback_ticket_id_unique"
  ON "public"."event_feedback" ("ticket_id");
CREATE INDEX IF NOT EXISTS "event_feedback_event_id_idx"
  ON "public"."event_feedback" ("event_id");
CREATE INDEX IF NOT EXISTS "event_feedback_email_idx"
  ON "public"."event_feedback" ("email");
CREATE INDEX IF NOT EXISTS "event_feedback_score_idx"
  ON "public"."event_feedback" ("score");

ALTER TABLE "public"."email_campaigns"
  ADD COLUMN IF NOT EXISTS "feedback_event_id" uuid REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD COLUMN IF NOT EXISTS "include_feedback_prompt" boolean NOT NULL DEFAULT false;
