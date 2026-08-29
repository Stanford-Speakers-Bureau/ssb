CREATE OR REPLACE FUNCTION "public"."cancel_ticket_and_promote"(
  "p_event_id" uuid,
  "p_email" text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_email TEXT;
  v_ticket_id UUID;
  v_ticket_scanned BOOLEAN;
  v_event_capacity BIGINT;
  v_event_reserved BIGINT;
  v_standby_enabled BOOLEAN;
  v_referrals_enabled BOOLEAN;
  v_public_tickets_sold BIGINT;
  v_vip_tickets_sold BIGINT;
  v_available_public_tickets BIGINT;
  v_max_public_capacity BIGINT;
  v_promoted_entry_id UUID;
  v_promoted_email TEXT;
  v_promoted_name TEXT;
  v_promoted_referral TEXT;
  v_promoted_position BIGINT;
  v_promoted_ticket_id UUID;
BEGIN
  v_user_email := NULLIF(lower(trim(p_email)), '');

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    e.capacity,
    COALESCE(e.reserved, 0),
    COALESCE(e.standby_enabled, false),
    COALESCE(e.referrals_enabled, false)
  INTO
    v_event_capacity,
    v_event_reserved,
    v_standby_enabled,
    v_referrals_enabled
  FROM events e
  WHERE e.id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'event_not_found: Event does not exist';
  END IF;

  SELECT id, scanned
  INTO v_ticket_id, v_ticket_scanned
  FROM tickets
  WHERE event_id = p_event_id
    AND email = v_user_email
  LIMIT 1
  FOR UPDATE;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'not_found: No ticket found for this event';
  END IF;

  IF COALESCE(v_ticket_scanned, false) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'already_scanned: Cannot cancel a scanned ticket';
  END IF;

  DELETE FROM tickets
  WHERE id = v_ticket_id;

  IF v_standby_enabled THEN
    RETURN jsonb_build_object(
      'success', true,
      'cancelled_ticket_id', v_ticket_id,
      'promoted', false
    );
  END IF;

  SELECT
    COALESCE(e.public_tickets_sold, 0),
    COALESCE(e.vip_tickets_sold, 0)
  INTO v_public_tickets_sold, v_vip_tickets_sold
  FROM events e
  WHERE e.id = p_event_id;

  IF v_vip_tickets_sold <= v_event_reserved THEN
    v_max_public_capacity := v_event_capacity - v_event_reserved;
  ELSE
    v_max_public_capacity := v_event_capacity - v_vip_tickets_sold;
  END IF;

  v_max_public_capacity := GREATEST(0, v_max_public_capacity);
  v_available_public_tickets := v_max_public_capacity - v_public_tickets_sold;

  IF v_available_public_tickets <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'cancelled_ticket_id', v_ticket_id,
      'promoted', false
    );
  END IF;

  LOOP
    SELECT w.id, w.email, w.name, w.referral, w.position
    INTO
      v_promoted_entry_id,
      v_promoted_email,
      v_promoted_name,
      v_promoted_referral,
      v_promoted_position
    FROM waitlist w
    WHERE w.event_id = p_event_id
      AND NOT EXISTS (
        SELECT 1
        FROM roles role_row
        WHERE lower(trim(role_row.email)) = lower(trim(w.email))
          AND role_row.roles ILIKE '%fee_waiver%'
          AND EXISTS (
            SELECT 1
            FROM unnest(string_to_array(COALESCE(role_row.roles, ''), ',')) AS role_name(role_value)
            WHERE lower(trim(role_value)) = 'fee_waiver'
          )
      )
    ORDER BY w.position ASC
    LIMIT 1
    FOR UPDATE OF w SKIP LOCKED;

    EXIT WHEN v_promoted_entry_id IS NULL;

    v_promoted_referral := NULLIF(lower(trim(v_promoted_referral)), '');

    IF NOT v_referrals_enabled THEN
      v_promoted_referral := NULL;
    ELSIF v_promoted_referral IS NOT NULL THEN
      IF v_promoted_referral = split_part(lower(trim(v_promoted_email)), '@', 1) THEN
        v_promoted_referral := NULL;
      ELSIF NOT EXISTS (
        SELECT 1
        FROM referrals r
        WHERE r.event_id = p_event_id
          AND r.referral_code = v_promoted_referral
      ) THEN
        v_promoted_referral := NULL;
      END IF;
    END IF;

    INSERT INTO tickets (event_id, email, name, type, referral)
    VALUES (
      p_event_id,
      v_promoted_email,
      v_promoted_name,
      'STANDARD',
      v_promoted_referral
    )
    ON CONFLICT (event_id, email) DO NOTHING
    RETURNING id INTO v_promoted_ticket_id;

    DELETE FROM waitlist
    WHERE id = v_promoted_entry_id;

    UPDATE waitlist
    SET position = position - 1
    WHERE event_id = p_event_id
      AND position > v_promoted_position;

    EXIT WHEN v_promoted_ticket_id IS NOT NULL;

    v_promoted_entry_id := NULL;
    v_promoted_email := NULL;
    v_promoted_name := NULL;
    v_promoted_referral := NULL;
    v_promoted_position := NULL;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'cancelled_ticket_id', v_ticket_id,
    'promoted', v_promoted_ticket_id IS NOT NULL,
    'promoted_ticket_id', v_promoted_ticket_id,
    'promoted_email', v_promoted_email,
    'promoted_name', v_promoted_name,
    'promoted_referral', v_promoted_referral,
    'promoted_ticket_type', CASE
      WHEN v_promoted_ticket_id IS NOT NULL THEN 'STANDARD'
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION "public"."cancel_ticket_and_promote"(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."cancel_ticket_and_promote"(uuid, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."cancel_ticket_and_promote"(uuid, text) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."cancel_ticket_and_promote"(uuid, text) TO "service_role";
