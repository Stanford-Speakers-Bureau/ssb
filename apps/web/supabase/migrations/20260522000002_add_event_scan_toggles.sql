-- Per-event scanning controls for the door check-in client.
--   identity_verification_enabled: show the "verify photo ID" prompt before admitting
--   allow_admitting_standby: when false, scanners hard-error on standby tickets

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "identity_verification_enabled" boolean NOT NULL DEFAULT true;

ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "allow_admitting_standby" boolean NOT NULL DEFAULT false;
