-- Add waitlist_mode column to events table
-- When true, scanners can scan WAITLIST-type tickets at the door
ALTER TABLE events ADD COLUMN IF NOT EXISTS waitlist boolean NOT NULL DEFAULT false;
