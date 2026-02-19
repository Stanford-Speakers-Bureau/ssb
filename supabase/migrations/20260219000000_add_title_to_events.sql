-- Migration: Add title column to events table
ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "title" text;
