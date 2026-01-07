-- ============================================================================
-- create_ticket RPC Function
-- ============================================================================
-- 
-- This function creates public tickets for events with proper capacity checking.
-- 
-- BUSINESS LOGIC:
-- - Reserved slots are pre-allocated for VIP tickets (admin-created)
-- - VIP tickets don't count towards public capacity (unless they overflow)
-- - If VIPs <= reserved: public gets (capacity - reserved) spots
-- - If VIPs > reserved: public gets (capacity - vip_count) spots (overflow)
-- - Total tickets (VIP + public) never exceed capacity
-- 
-- USAGE:
-- Run this in Supabase SQL Editor to update the function
-- 
-- ============================================================================

CREATE OR REPLACE FUNCTION create_ticket(
  p_event_id UUID,
  p_referral TEXT DEFAULT NULL
)
RETURNS jsonb AS $$
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
  -- Get current user's email from JWT claims
  v_user_email := (auth.jwt() ->> 'email');
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock event row and get capacity info (FOR UPDATE prevents race conditions)
  SELECT 
    e.capacity,
    COALESCE(e.reserved, 0)
  INTO v_event_capacity, v_event_reserved
  FROM events e
  WHERE e.id = p_event_id
  FOR UPDATE;

  -- Check if event exists
  IF NOT FOUND THEN
    RAISE EXCEPTION USING 
      ERRCODE = 'P0001',
      MESSAGE = 'event_not_found: Event does not exist';
  END IF;

  -- Count PUBLIC tickets only (STANDARD or null type)
  -- VIP tickets don't reduce public capacity (unless they overflow reserved)
  SELECT COUNT(*)::BIGINT
  INTO v_public_tickets_sold
  FROM tickets
  WHERE event_id = p_event_id
    AND (type = 'STANDARD' OR type IS NULL);

  -- Count VIP tickets (admin-created only)
  SELECT COUNT(*)::BIGINT
  INTO v_vip_tickets_sold
  FROM tickets
  WHERE event_id = p_event_id
    AND type = 'VIP';

  -- Calculate max public capacity with VIP overflow protection
  -- If VIPs <= reserved: public gets (capacity - reserved) spots
  -- If VIPs > reserved: public gets (capacity - vip_count) spots
  IF v_vip_tickets_sold <= v_event_reserved THEN
    v_max_public_capacity := v_event_capacity - v_event_reserved;
  ELSE
    -- VIP overflow: VIPs exceeded reserved allocation
    v_max_public_capacity := v_event_capacity - v_vip_tickets_sold;
  END IF;

  -- Ensure non-negative capacity
  v_max_public_capacity := GREATEST(0, v_max_public_capacity);

  -- Calculate available public tickets
  v_available_public_tickets := v_max_public_capacity - v_public_tickets_sold;

  -- Check if public capacity is exceeded
  IF v_available_public_tickets <= 0 THEN
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

  -- Insert the new PUBLIC ticket
  INSERT INTO tickets (
    event_id,
    email,
    type,
    referral
  )
  VALUES (
    p_event_id,
    v_user_email,
    'STANDARD', -- Default ticket type for public (via RPC)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- TESTING QUERIES
-- ============================================================================
-- 
-- Use these queries to verify the ticket counting logic works correctly:

-- 1. Check ticket counts for an event
-- Replace 'YOUR_EVENT_ID' with actual event UUID
/*
SELECT 
  e.id,
  e.name,
  e.capacity,
  e.reserved,
  COUNT(*) FILTER (WHERE t.type = 'VIP') as vip_count,
  COUNT(*) FILTER (WHERE t.type = 'STANDARD' OR t.type IS NULL) as public_count,
  COUNT(*) as total_tickets,
  e.capacity - COALESCE(e.reserved, 0) as intended_public_capacity,
  CASE 
    WHEN COUNT(*) FILTER (WHERE t.type = 'VIP') <= COALESCE(e.reserved, 0) 
    THEN e.capacity - COALESCE(e.reserved, 0)
    ELSE e.capacity - COUNT(*) FILTER (WHERE t.type = 'VIP')
  END as actual_public_capacity
FROM events e
LEFT JOIN tickets t ON t.event_id = e.id
WHERE e.id = 'YOUR_EVENT_ID'
GROUP BY e.id, e.name, e.capacity, e.reserved;
*/

-- 2. Test ticket creation (run as authenticated user)
/*
SELECT create_ticket(
  'YOUR_EVENT_ID'::uuid,
  NULL  -- or referral code
);
*/

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- 
-- BEFORE running this update:
-- 1. Backup the current function:
--    - Go to Supabase Dashboard > Database > Functions
--    - Copy the current create_ticket function code
-- 
-- AFTER running this update:
-- 1. Test with the queries above
-- 2. Verify existing tickets still work
-- 3. Create a test ticket to verify capacity logic
-- 
-- ============================================================================
