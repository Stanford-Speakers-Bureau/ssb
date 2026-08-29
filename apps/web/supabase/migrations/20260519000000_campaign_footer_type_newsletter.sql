-- The original footer_type CHECK constraint (20260513010000) predates the
-- newsletter unsubscribe scope. The app now writes 'newsletter_unsubscribe'
-- for newsletter campaigns, which the old constraint rejects. Widen the set.
ALTER TABLE "public"."email_campaigns"
  DROP CONSTRAINT IF EXISTS "email_campaigns_footer_type_check";

ALTER TABLE "public"."email_campaigns"
  ADD CONSTRAINT "email_campaigns_footer_type_check"
    CHECK ("footer_type" IN (
      'event_unsubscribe',
      'announce_unsubscribe',
      'newsletter_unsubscribe',
      'essential',
      'none'
    ));
