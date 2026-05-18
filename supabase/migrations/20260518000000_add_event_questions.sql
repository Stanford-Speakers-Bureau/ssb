-- Event-scoped Q&A: people suggest and upvote questions for an event

CREATE TABLE IF NOT EXISTS "public"."event_questions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "event_id" uuid NOT NULL REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "email" text NOT NULL,
  "question" text NOT NULL,
  "approved" boolean NOT NULL DEFAULT false,
  "reviewed" boolean NOT NULL DEFAULT false,
  "duplicate" boolean NOT NULL DEFAULT false,
  "hidden" boolean NOT NULL DEFAULT false,
  "votes" bigint NOT NULL DEFAULT 0,
  CONSTRAINT "event_questions_length_check"
    CHECK (char_length(trim("question")) BETWEEN 4 AND 280)
);

CREATE TABLE IF NOT EXISTS "public"."event_question_votes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "question_id" uuid NOT NULL REFERENCES "public"."event_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "email" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "event_questions_event_id_idx"
  ON "public"."event_questions" ("event_id");
CREATE INDEX IF NOT EXISTS "event_questions_event_public_idx"
  ON "public"."event_questions" ("event_id", "approved", "hidden", "votes");
CREATE INDEX IF NOT EXISTS "event_questions_reviewed_idx"
  ON "public"."event_questions" ("reviewed");
CREATE INDEX IF NOT EXISTS "event_questions_email_idx"
  ON "public"."event_questions" ("email");

CREATE UNIQUE INDEX IF NOT EXISTS "event_question_votes_email_question_unique"
  ON "public"."event_question_votes" ("email", "question_id");
CREATE INDEX IF NOT EXISTS "event_question_votes_question_id_idx"
  ON "public"."event_question_votes" ("question_id");
CREATE INDEX IF NOT EXISTS "event_question_votes_email_idx"
  ON "public"."event_question_votes" ("email");

-- Trigger functions: maintain denormalized votes count
CREATE OR REPLACE FUNCTION "public"."increment_event_question_votes_on_insert"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.event_questions
  SET votes = COALESCE(votes, 0) + 1
  WHERE id = NEW.question_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."decrement_event_question_votes_on_delete"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.event_questions
  SET votes = GREATEST(COALESCE(votes, 0) - 1, 0)
  WHERE id = OLD.question_id;

  RETURN OLD;
END;
$$;

ALTER FUNCTION "public"."increment_event_question_votes_on_insert"() OWNER TO "postgres";
ALTER FUNCTION "public"."decrement_event_question_votes_on_delete"() OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."increment_event_question_votes_on_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_event_question_votes_on_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_event_question_votes_on_insert"() TO "service_role";

GRANT ALL ON FUNCTION "public"."decrement_event_question_votes_on_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_event_question_votes_on_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_event_question_votes_on_delete"() TO "service_role";

DROP TRIGGER IF EXISTS "trg_event_question_votes_after_insert" ON "public"."event_question_votes";
CREATE TRIGGER "trg_event_question_votes_after_insert"
AFTER INSERT ON "public"."event_question_votes"
FOR EACH ROW
EXECUTE FUNCTION "public"."increment_event_question_votes_on_insert"();

DROP TRIGGER IF EXISTS "trg_event_question_votes_after_delete" ON "public"."event_question_votes";
CREATE TRIGGER "trg_event_question_votes_after_delete"
AFTER DELETE ON "public"."event_question_votes"
FOR EACH ROW
EXECUTE FUNCTION "public"."decrement_event_question_votes_on_delete"();

-- RLS: service_role only (Drizzle queries go through service_role; public/auth get no direct access)
ALTER TABLE "public"."event_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."event_question_votes" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."event_questions" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."event_questions" FROM "anon";
REVOKE ALL ON TABLE "public"."event_questions" FROM "authenticated";
GRANT ALL ON TABLE "public"."event_questions" TO "service_role";

REVOKE ALL ON TABLE "public"."event_question_votes" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."event_question_votes" FROM "anon";
REVOKE ALL ON TABLE "public"."event_question_votes" FROM "authenticated";
GRANT ALL ON TABLE "public"."event_question_votes" TO "service_role";

DROP POLICY IF EXISTS "service_role_can_manage_event_questions" ON "public"."event_questions";
CREATE POLICY "service_role_can_manage_event_questions"
ON "public"."event_questions"
FOR ALL
TO "service_role"
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_can_manage_event_question_votes" ON "public"."event_question_votes";
CREATE POLICY "service_role_can_manage_event_question_votes"
ON "public"."event_question_votes"
FOR ALL
TO "service_role"
USING (true)
WITH CHECK (true);
