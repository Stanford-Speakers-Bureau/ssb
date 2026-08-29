-- Migration: Add external ticketing fields to events table
-- Some events are ticketed off-platform; admins can toggle this and set a link,
-- and the public site redirects the "Get Tickets" button to that URL.
ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "external_ticketing_enabled" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "external_ticketing_url" text;
