-- RPC Function: create_ticket
-- Atomically creates a ticket for the current authenticated user
-- 
-- Usage:
--   Supabase JS: await supabase.rpc('create_ticket', { 
--     p_event_id: 'uuid',
--     p_referral: 'referral-code' // optional
--   })
--
-- This function:
-- - Locks the event row (FOR UPDATE) to prevent race conditions
-- - Checks capacity using (capacity - COALESCE(tickets, reserved, 0))
-- - Checks for an existing ticket for this email
-- - Inserts the ticket atomically
--
-- Raises exceptions:
-- - P0001 with message containing "event_not_found" if event doesn't exist
-- - P0001 with message containing "capacity" if capacity exceeded
-- - P0001 with message containing "already" if user already has a ticket

CREATE OR REPLACE FUNCTION create_ticket(
  p_event_id UUID,
  p_referral TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
  v_event_capacity INTEGER;
  v_event_tickets INTEGER;
  v_event_reserved INTEGER;
  v_tickets_sold BIGINT;
  v_available_tickets INTEGER;
  v_existing_ticket_id UUID;
  v_new_ticket_id UUID;
BEGIN
  -- Get current user's email from JWT claims
  -- In Supabase, the email is stored in the JWT token
  v_user_email := (auth.jwt() ->> 'email');
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock event row and get capacity info (FOR UPDATE prevents race conditions)
  SELECT 
    e.capacity,
    COALESCE(e.tickets, 0),
    COALESCE(e.reserved, 0)
  INTO v_event_capacity, v_event_tickets, v_event_reserved
  FROM events e
  WHERE e.id = p_event_id
  FOR UPDATE;

  -- Check if event exists
  IF NOT FOUND THEN
    RAISE EXCEPTION USING 
      ERRCODE = 'P0001',
      MESSAGE = 'event_not_found: Event does not exist';
  END IF;

  -- Count actual tickets sold for this event (source of truth)
  SELECT COUNT(*)::BIGINT
  INTO v_tickets_sold
  FROM tickets
  WHERE event_id = p_event_id;

  -- Calculate available tickets
  -- Use actual ticket count as source of truth
  -- Also account for manually set tickets/reserved fields if they're higher
  -- (in case of manual overrides or pre-reserved seats)
  v_available_tickets := v_event_capacity - GREATEST(
    v_tickets_sold,
    COALESCE(v_event_tickets, 0),
    COALESCE(v_event_reserved, 0)
  );

  -- Check if capacity is exceeded
  IF v_available_tickets <= 0 THEN
    RAISE EXCEPTION USING 
      ERRCODE = 'P0001',
      MESSAGE = 'capacity: This event is at full capacity';
  END IF;

  -- Check if user already has a ticket for this event
  SELECT id
  INTO v_existing_ticket_id
  FROM tickets
  WHERE event_id = p_event_id
    AND email = v_user_email
  LIMIT 1;

  IF v_existing_ticket_id IS NOT NULL THEN
    RAISE EXCEPTION USING 
      ERRCODE = 'P0001',
      MESSAGE = 'already: You already have a ticket for this event';
  END IF;

  -- Insert the new ticket
  INSERT INTO tickets (
    event_id,
    email,
    type,
    referral
  )
  VALUES (
    p_event_id,
    v_user_email,
    'STANDARD', -- Default ticket type
    p_referral
  )
  RETURNING id INTO v_new_ticket_id;

  -- Return success with ticket ID
  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_new_ticket_id,
    'email', v_user_email,
    'event_id', p_event_id
  );
END;
$$;

-- Grant execute permission (adjust based on your RLS policies)
-- GRANT EXECUTE ON FUNCTION create_ticket(UUID, TEXT) TO authenticated;

