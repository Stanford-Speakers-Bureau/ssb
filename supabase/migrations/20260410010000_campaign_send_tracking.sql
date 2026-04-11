-- Track in-flight campaign sends and terminal partial-send counts.
ALTER TABLE "public"."email_campaigns"
ADD COLUMN IF NOT EXISTS "failed_count" bigint NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "send_batch_id" text;

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
