-- Fine-grained, optionally event-scoped permissions granted to a person by
-- email. `action` is one of the PERMISSION_ACTIONS (see app/lib/permissions.ts).
-- A NULL event_id means the grant applies to ALL events (and to global actions
-- like suggestions.manage / events.create). The `admin` role in "roles" remains
-- a super-admin that bypasses these checks entirely.

CREATE TABLE IF NOT EXISTS "public"."permission_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "email" text NOT NULL,
  "action" text NOT NULL,
  "event_id" uuid REFERENCES "public"."events"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "granted_by" text NOT NULL
);

-- Unique per (person, action, event). NULL event_id rows (all-events grants)
-- are treated as distinct by Postgres, so the grant API dedupes those itself.
CREATE UNIQUE INDEX IF NOT EXISTS "permission_grants_unique"
  ON "public"."permission_grants" ("email", "action", "event_id");
CREATE INDEX IF NOT EXISTS "permission_grants_email_idx"
  ON "public"."permission_grants" ("email");
CREATE INDEX IF NOT EXISTS "permission_grants_event_id_idx"
  ON "public"."permission_grants" ("event_id");

-- RLS: service_role only (Drizzle queries go through service_role; public/auth get no direct access)
ALTER TABLE "public"."permission_grants" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."permission_grants" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."permission_grants" FROM "anon";
REVOKE ALL ON TABLE "public"."permission_grants" FROM "authenticated";
GRANT ALL ON TABLE "public"."permission_grants" TO "service_role";

DROP POLICY IF EXISTS "service_role_can_manage_permission_grants" ON "public"."permission_grants";
CREATE POLICY "service_role_can_manage_permission_grants"
ON "public"."permission_grants"
FOR ALL
TO "service_role"
USING (true)
WITH CHECK (true);
