-- ──────────────────────────────────────────────────────────────────────────
-- Mailing list system: canonical email helper + mailing_list + email_unsubscribes
-- ──────────────────────────────────────────────────────────────────────────

-- Email canonicalization: strip +suffix for all domains, strip dots only for
-- Google domains. Used for dedup so anish@gmail.com == anish+1@gmail.com ==
-- a.n.i.s.h@gmail.com. Stanford uses Google Workspace but does NOT honor
-- dot-equivalence, so it's deliberately excluded.
CREATE OR REPLACE FUNCTION public.canonicalize_email(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  trimmed text;
  local_part text;
  domain text;
  at_pos int;
BEGIN
  IF input IS NULL THEN RETURN NULL; END IF;
  trimmed := lower(btrim(input));
  IF trimmed = '' THEN RETURN ''; END IF;

  at_pos := position('@' in trimmed);
  IF at_pos = 0 THEN RETURN trimmed; END IF;

  local_part := substring(trimmed FROM 1 FOR at_pos - 1);
  domain := substring(trimmed FROM at_pos + 1);

  -- Strip +suffix from local part (RFC 5233 sub-addressing).
  -- Refuse to strip when the local part starts with '+' (would yield empty).
  IF position('+' in local_part) > 1 THEN
    local_part := split_part(local_part, '+', 1);
  END IF;

  IF domain IN ('gmail.com', 'googlemail.com') THEN
    local_part := replace(local_part, '.', '');
  END IF;

  IF local_part = '' THEN RETURN trimmed; END IF;

  RETURN local_part || '@' || domain;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────────
-- mailing_list: one row per canonical email we know about.
-- Announce list = mailing_list MINUS email_unsubscribes(scope='announce').
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."mailing_list" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "email" text NOT NULL,
  "display_email" text NOT NULL,
  "source" text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "mailing_list_email_unique"
  ON "public"."mailing_list" ("email");
CREATE INDEX IF NOT EXISTS "mailing_list_source_idx"
  ON "public"."mailing_list" ("source");
CREATE INDEX IF NOT EXISTS "mailing_list_created_at_idx"
  ON "public"."mailing_list" ("created_at");

ALTER TABLE "public"."mailing_list" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."mailing_list" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."mailing_list" FROM "anon";
REVOKE ALL ON TABLE "public"."mailing_list" FROM "authenticated";

GRANT ALL ON TABLE "public"."mailing_list" TO "service_role";

DROP POLICY IF EXISTS "service_role_can_manage_mailing_list" ON "public"."mailing_list";

CREATE POLICY "service_role_can_manage_mailing_list"
ON "public"."mailing_list"
FOR ALL
TO "service_role"
USING (true)
WITH CHECK (true);

-- ──────────────────────────────────────────────────────────────────────────
-- email_unsubscribes: per-scope opt-out records.
-- Two scopes: 'announce' (one row per email) and 'event' (one row per email
-- per event). Email is stored canonical so dedup matches the mailing_list key.
-- ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."email_unsubscribes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "email" text NOT NULL,
  "scope" text NOT NULL,
  "event_id" uuid REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "source" text NOT NULL,
  "reason" text,
  "actor" text NOT NULL,
  CONSTRAINT email_unsubscribes_scope_check
    CHECK ("scope" IN ('announce', 'event')),
  CONSTRAINT email_unsubscribes_scope_event_check
    CHECK (
      ("scope" = 'announce' AND "event_id" IS NULL)
      OR ("scope" = 'event' AND "event_id" IS NOT NULL)
    )
);

ALTER TABLE "public"."email_unsubscribes" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."email_unsubscribes" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."email_unsubscribes" FROM "anon";
REVOKE ALL ON TABLE "public"."email_unsubscribes" FROM "authenticated";

GRANT ALL ON TABLE "public"."email_unsubscribes" TO "service_role";

DROP POLICY IF EXISTS "service_role_can_manage_email_unsubscribes" ON "public"."email_unsubscribes";

CREATE POLICY "service_role_can_manage_email_unsubscribes"
ON "public"."email_unsubscribes"
FOR ALL
TO "service_role"
USING (true)
WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS "email_unsubscribes_announce_unique"
  ON "public"."email_unsubscribes" ("email")
  WHERE "scope" = 'announce';

CREATE UNIQUE INDEX IF NOT EXISTS "email_unsubscribes_event_unique"
  ON "public"."email_unsubscribes" ("email", "event_id")
  WHERE "scope" = 'event';

CREATE INDEX IF NOT EXISTS "email_unsubscribes_scope_event_idx"
  ON "public"."email_unsubscribes" ("scope", "event_id");

CREATE INDEX IF NOT EXISTS "email_unsubscribes_email_lower_idx"
  ON "public"."email_unsubscribes" (lower("email"));

-- ──────────────────────────────────────────────────────────────────────────
-- Backfill mailing_list from every email-bearing table.
-- Dedup by canonical email; keep the earliest-seen original as display_email
-- and the earliest created_at.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO "public"."mailing_list" (email, display_email, source, created_at, updated_at)
SELECT
  public.canonicalize_email(combined.email) AS email,
  (array_agg(combined.email ORDER BY combined.created_at ASC))[1] AS display_email,
  'backfill' AS source,
  MIN(combined.created_at) AS created_at,
  now() AS updated_at
FROM (
  SELECT email, created_at FROM tickets WHERE email IS NOT NULL
  UNION ALL
  SELECT email, created_at FROM waitlist WHERE email IS NOT NULL
  UNION ALL
  SELECT email, created_at FROM user_profiles WHERE email IS NOT NULL
  UNION ALL
  SELECT email, created_at FROM notify WHERE email IS NOT NULL
  UNION ALL
  SELECT email, created_at FROM suggest WHERE email IS NOT NULL
  UNION ALL
  SELECT email, created_at FROM votes WHERE email IS NOT NULL
) AS combined
WHERE combined.email IS NOT NULL
  AND public.canonicalize_email(combined.email) <> ''
  AND public.canonicalize_email(combined.email) LIKE '%@%'
GROUP BY public.canonicalize_email(combined.email)
ON CONFLICT (email) DO NOTHING;
