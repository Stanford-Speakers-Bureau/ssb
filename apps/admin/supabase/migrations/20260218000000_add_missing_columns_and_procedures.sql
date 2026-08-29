-- Migration: Add missing columns and stored procedures
-- These exist in production but were missing from the initial schema dump

-- Add missing columns to tickets table
ALTER TABLE "public"."tickets" ADD COLUMN IF NOT EXISTS "name" text;

-- Add missing columns to waitlist table
ALTER TABLE "public"."waitlist" ADD COLUMN IF NOT EXISTS "name" text;

-- Add missing columns to events table
ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "ticketing_date" timestamp with time zone;
ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "livestream" boolean DEFAULT false;
ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "scanned_count" bigint DEFAULT 0 NOT NULL;
ALTER TABLE "public"."events" ADD COLUMN IF NOT EXISTS "waitlist_chance" text;

-- Create create_ticket_with_name stored procedure
-- Modified from create_ticket to accept p_user_name and p_email parameters
-- instead of reading from auth.jwt() (for Prisma compatibility)
CREATE OR REPLACE FUNCTION "public"."create_ticket_with_name"(
  "p_event_id" uuid,
  "p_referral" text DEFAULT NULL,
  "p_user_name" text DEFAULT NULL,
  "p_email" text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_event_capacity INTEGER;
  v_event_reserved INTEGER;
  v_public_tickets_sold BIGINT;
  v_vip_tickets_sold BIGINT;
  v_available_public_tickets INTEGER;
  v_max_public_capacity INTEGER;
  v_existing_ticket_id UUID;
  v_new_ticket_id UUID;
BEGIN
  -- Get email from parameter or fall back to JWT
  v_user_email := COALESCE(p_email, (auth.jwt() ->> 'email'));

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock event row and get capacity info
  SELECT
    e.capacity,
    COALESCE(e.reserved, 0)
  INTO v_event_capacity, v_event_reserved
  FROM events e
  WHERE e.id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'event_not_found: Event does not exist';
  END IF;

  -- Count PUBLIC tickets only
  SELECT COUNT(*)::BIGINT
  INTO v_public_tickets_sold
  FROM tickets
  WHERE event_id = p_event_id
    AND (type = 'STANDARD' OR type IS NULL);

  -- Count VIP tickets
  SELECT COUNT(*)::BIGINT
  INTO v_vip_tickets_sold
  FROM tickets
  WHERE event_id = p_event_id
    AND type = 'VIP';

  -- Calculate max public capacity with VIP overflow protection
  IF v_vip_tickets_sold <= v_event_reserved THEN
    v_max_public_capacity := v_event_capacity - v_event_reserved;
  ELSE
    v_max_public_capacity := v_event_capacity - v_vip_tickets_sold;
  END IF;

  v_max_public_capacity := GREATEST(0, v_max_public_capacity);
  v_available_public_tickets := v_max_public_capacity - v_public_tickets_sold;

  IF v_available_public_tickets <= 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'capacity: This event is at full capacity';
  END IF;

  -- Check if user already has a ticket
  SELECT id INTO v_existing_ticket_id
  FROM tickets
  WHERE event_id = p_event_id
    AND email = v_user_email
  LIMIT 1;

  IF v_existing_ticket_id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'already: You already have a ticket for this event';
  END IF;

  -- Insert new ticket with name
  INSERT INTO tickets (event_id, email, type, referral, name)
  VALUES (p_event_id, v_user_email, 'STANDARD', p_referral, p_user_name)
  RETURNING id INTO v_new_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_new_ticket_id,
    'email', v_user_email,
    'event_id', p_event_id
  );
END;
$$;

ALTER FUNCTION "public"."create_ticket_with_name"(uuid, text, text, text) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."create_ticket_with_name"(uuid, text, text, text) TO "anon";
GRANT ALL ON FUNCTION "public"."create_ticket_with_name"(uuid, text, text, text) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ticket_with_name"(uuid, text, text, text) TO "service_role";


-- Create join_waitlist_with_name stored procedure
-- Modified from join_waitlist to accept p_name and p_email parameters
CREATE OR REPLACE FUNCTION "public"."join_waitlist_with_name"(
  "p_event_id" uuid,
  "p_referral" text DEFAULT NULL,
  "p_name" text DEFAULT NULL,
  "p_email" text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_next_position INTEGER;
  v_total_count INTEGER;
  v_existing_entry UUID;
  v_new_entry_id UUID;
BEGIN
  -- Get email from parameter or fall back to JWT
  v_user_email := COALESCE(p_email, (auth.jwt() ->> 'email'));

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock waitlist entries for this event
  PERFORM 1 FROM waitlist
  WHERE event_id = p_event_id
  FOR UPDATE;

  -- Check if already on waitlist
  SELECT id INTO v_existing_entry
  FROM waitlist
  WHERE event_id = p_event_id
    AND email = v_user_email
  LIMIT 1;

  IF v_existing_entry IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'already: You are already on the waitlist for this event';
  END IF;

  -- Calculate next position atomically
  SELECT COALESCE(MAX(position), 0) + 1
  INTO v_next_position
  FROM waitlist
  WHERE event_id = p_event_id;

  -- Insert new waitlist entry with name
  INSERT INTO waitlist (event_id, email, referral, position, name)
  VALUES (p_event_id, v_user_email, p_referral, v_next_position, p_name)
  RETURNING id INTO v_new_entry_id;

  -- Get total count
  SELECT COUNT(*)::INTEGER
  INTO v_total_count
  FROM waitlist
  WHERE event_id = p_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_new_entry_id,
    'position', v_next_position,
    'total', v_total_count,
    'email', v_user_email
  );
END;
$$;

ALTER FUNCTION "public"."join_waitlist_with_name"(uuid, text, text, text) OWNER TO "postgres";

GRANT ALL ON FUNCTION "public"."join_waitlist_with_name"(uuid, text, text, text) TO "anon";
GRANT ALL ON FUNCTION "public"."join_waitlist_with_name"(uuid, text, text, text) TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_waitlist_with_name"(uuid, text, text, text) TO "service_role";


-- Update leave_waitlist to accept email parameter (for Prisma compatibility)
CREATE OR REPLACE FUNCTION "public"."leave_waitlist"("p_event_id" uuid, "p_email" text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_email TEXT;
  v_deleted_position INTEGER;
  v_existing_entry UUID;
BEGIN
  v_user_email := COALESCE(p_email, (auth.jwt() ->> 'email'));

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM 1 FROM waitlist
  WHERE event_id = p_event_id
  FOR UPDATE;

  SELECT id, position INTO v_existing_entry, v_deleted_position
  FROM waitlist
  WHERE event_id = p_event_id
    AND email = v_user_email
  LIMIT 1;

  IF v_existing_entry IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'not_found: You are not on the waitlist for this event';
  END IF;

  DELETE FROM waitlist WHERE id = v_existing_entry;

  UPDATE waitlist
  SET position = position - 1
  WHERE event_id = p_event_id
    AND position > v_deleted_position;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_position', v_deleted_position,
    'email', v_user_email
  );
END;
$$;
