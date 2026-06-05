-- Customizable copy for the campaign "please cancel" callout. The clickable
-- cancel link is the portion wrapped in [square brackets]; the rest is plain
-- text. Defaults to the original hard-coded sentence so existing campaigns are
-- unchanged.
ALTER TABLE "public"."email_campaigns"
  ADD COLUMN IF NOT EXISTS "cancel_callout_text" text NOT NULL
    DEFAULT 'Can''t make it? [Please cancel] so someone else can attend.';
