-- Email campaigns table for admin mass email feature
CREATE TABLE IF NOT EXISTS "public"."email_campaigns" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "subject" text NOT NULL,
  "body" text NOT NULL DEFAULT '',
  "status" text NOT NULL DEFAULT 'draft',
  "audience_type" text NOT NULL,
  "event_id" uuid REFERENCES "public"."events"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "include_hero_card" boolean NOT NULL DEFAULT false,
  "sent_at" timestamptz,
  "sent_by" text,
  "recipient_count" bigint,
  "created_by" text NOT NULL
);

ALTER TABLE "public"."email_campaigns" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."email_campaigns" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."email_campaigns" FROM "anon";
REVOKE ALL ON TABLE "public"."email_campaigns" FROM "authenticated";

GRANT ALL ON TABLE "public"."email_campaigns" TO "service_role";

DROP POLICY IF EXISTS "service_role_can_manage_email_campaigns" ON "public"."email_campaigns";

CREATE POLICY "service_role_can_manage_email_campaigns"
ON "public"."email_campaigns"
FOR ALL
TO "service_role"
USING (true)
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS "email_campaigns_status_idx" ON "public"."email_campaigns" ("status");
CREATE INDEX IF NOT EXISTS "email_campaigns_created_at_idx" ON "public"."email_campaigns" ("created_at");
