ALTER TABLE "public"."events"
  ADD COLUMN IF NOT EXISTS "public_tickets_sold" bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "vip_tickets_sold" bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "standby_tickets_sold" bigint NOT NULL DEFAULT 0;

UPDATE "public"."events" e
SET
  "public_tickets_sold" = COALESCE((
    SELECT COUNT(*)::bigint
    FROM "public"."tickets" t
    WHERE t."event_id" = e."id"
      AND COALESCE(t."type", 'STANDARD') <> 'VIP'
      AND COALESCE(t."type", 'STANDARD') <> 'STANDBY'
  ), 0),
  "vip_tickets_sold" = COALESCE((
    SELECT COUNT(*)::bigint
    FROM "public"."tickets" t
    WHERE t."event_id" = e."id"
      AND COALESCE(t."type", 'STANDARD') = 'VIP'
  ), 0),
  "standby_tickets_sold" = COALESCE((
    SELECT COUNT(*)::bigint
    FROM "public"."tickets" t
    WHERE t."event_id" = e."id"
      AND COALESCE(t."type", 'STANDARD') = 'STANDBY'
  ), 0);

CREATE OR REPLACE FUNCTION "public"."adjust_event_ticket_type_counters"()
RETURNS "trigger"
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.event_id IS NOT NULL THEN
      UPDATE public.events
      SET
        public_tickets_sold = COALESCE(public_tickets_sold, 0)
          + CASE
            WHEN COALESCE(NEW.type, 'STANDARD') <> 'VIP'
              AND COALESCE(NEW.type, 'STANDARD') <> 'STANDBY'
            THEN 1
            ELSE 0
          END,
        vip_tickets_sold = COALESCE(vip_tickets_sold, 0)
          + CASE WHEN COALESCE(NEW.type, 'STANDARD') = 'VIP' THEN 1 ELSE 0 END,
        standby_tickets_sold = COALESCE(standby_tickets_sold, 0)
          + CASE WHEN COALESCE(NEW.type, 'STANDARD') = 'STANDBY' THEN 1 ELSE 0 END
      WHERE id = NEW.event_id;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.event_id IS NOT NULL THEN
      UPDATE public.events
      SET
        public_tickets_sold = GREATEST(
          COALESCE(public_tickets_sold, 0)
            - CASE
              WHEN COALESCE(OLD.type, 'STANDARD') <> 'VIP'
                AND COALESCE(OLD.type, 'STANDARD') <> 'STANDBY'
              THEN 1
              ELSE 0
            END,
          0
        ),
        vip_tickets_sold = GREATEST(
          COALESCE(vip_tickets_sold, 0)
            - CASE WHEN COALESCE(OLD.type, 'STANDARD') = 'VIP' THEN 1 ELSE 0 END,
          0
        ),
        standby_tickets_sold = GREATEST(
          COALESCE(standby_tickets_sold, 0)
            - CASE WHEN COALESCE(OLD.type, 'STANDARD') = 'STANDBY' THEN 1 ELSE 0 END,
          0
        )
      WHERE id = OLD.event_id;
    END IF;

    RETURN OLD;
  END IF;

  IF OLD.event_id IS NOT DISTINCT FROM NEW.event_id
    AND COALESCE(OLD.type, 'STANDARD') = COALESCE(NEW.type, 'STANDARD')
  THEN
    RETURN NEW;
  END IF;

  IF OLD.event_id IS NOT NULL THEN
    UPDATE public.events
    SET
      public_tickets_sold = GREATEST(
        COALESCE(public_tickets_sold, 0)
          - CASE
            WHEN COALESCE(OLD.type, 'STANDARD') <> 'VIP'
              AND COALESCE(OLD.type, 'STANDARD') <> 'STANDBY'
            THEN 1
            ELSE 0
          END,
        0
      ),
      vip_tickets_sold = GREATEST(
        COALESCE(vip_tickets_sold, 0)
          - CASE WHEN COALESCE(OLD.type, 'STANDARD') = 'VIP' THEN 1 ELSE 0 END,
        0
      ),
      standby_tickets_sold = GREATEST(
        COALESCE(standby_tickets_sold, 0)
          - CASE WHEN COALESCE(OLD.type, 'STANDARD') = 'STANDBY' THEN 1 ELSE 0 END,
        0
      )
    WHERE id = OLD.event_id;
  END IF;

  IF NEW.event_id IS NOT NULL THEN
    UPDATE public.events
    SET
      public_tickets_sold = COALESCE(public_tickets_sold, 0)
        + CASE
          WHEN COALESCE(NEW.type, 'STANDARD') <> 'VIP'
            AND COALESCE(NEW.type, 'STANDARD') <> 'STANDBY'
          THEN 1
          ELSE 0
        END,
      vip_tickets_sold = COALESCE(vip_tickets_sold, 0)
        + CASE WHEN COALESCE(NEW.type, 'STANDARD') = 'VIP' THEN 1 ELSE 0 END,
      standby_tickets_sold = COALESCE(standby_tickets_sold, 0)
        + CASE WHEN COALESCE(NEW.type, 'STANDARD') = 'STANDBY' THEN 1 ELSE 0 END
    WHERE id = NEW.event_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ticket_type_counter_trigger" ON "public"."tickets";

CREATE TRIGGER "ticket_type_counter_trigger"
AFTER INSERT OR DELETE OR UPDATE OF "event_id", "type"
ON "public"."tickets"
FOR EACH ROW
EXECUTE FUNCTION "public"."adjust_event_ticket_type_counters"();

CREATE OR REPLACE FUNCTION "public"."create_ticket_with_name"(
  "p_event_id" uuid,
  "p_referral" text DEFAULT NULL,
  "p_user_name" text DEFAULT NULL,
  "p_email" text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_email TEXT;
  v_event_capacity BIGINT;
  v_event_reserved BIGINT;
  v_standby_enabled BOOLEAN;
  v_public_tickets_sold BIGINT;
  v_vip_tickets_sold BIGINT;
  v_available_public_tickets BIGINT;
  v_max_public_capacity BIGINT;
  v_existing_ticket_id UUID;
  v_new_ticket_id UUID;
BEGIN
  v_user_email := NULLIF(lower(trim(p_email)), '');

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    e.capacity,
    COALESCE(e.reserved, 0),
    COALESCE(e.standby_enabled, false),
    COALESCE(e.public_tickets_sold, 0),
    COALESCE(e.vip_tickets_sold, 0)
  INTO
    v_event_capacity,
    v_event_reserved,
    v_standby_enabled,
    v_public_tickets_sold,
    v_vip_tickets_sold
  FROM events e
  WHERE e.id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'event_not_found: Event does not exist';
  END IF;

  IF v_standby_enabled THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'standby_only: The standby line is open.';
  END IF;

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

REVOKE ALL ON FUNCTION "public"."create_ticket_with_name"(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."create_ticket_with_name"(uuid, text, text, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."create_ticket_with_name"(uuid, text, text, text) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."create_ticket_with_name"(uuid, text, text, text) TO "service_role";

CREATE OR REPLACE FUNCTION "public"."join_waitlist_with_name"(
  "p_event_id" uuid,
  "p_referral" text DEFAULT NULL,
  "p_name" text DEFAULT NULL,
  "p_email" text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_email TEXT;
  v_event_capacity BIGINT;
  v_event_reserved BIGINT;
  v_standby_enabled BOOLEAN;
  v_public_tickets_sold BIGINT;
  v_vip_tickets_sold BIGINT;
  v_available_public_tickets BIGINT;
  v_max_public_capacity BIGINT;
  v_next_position BIGINT;
  v_total_count INTEGER;
  v_existing_entry UUID;
  v_existing_ticket_id UUID;
  v_new_entry_id UUID;
BEGIN
  v_user_email := NULLIF(lower(trim(p_email)), '');

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    e.capacity,
    COALESCE(e.reserved, 0),
    COALESCE(e.standby_enabled, false),
    COALESCE(e.public_tickets_sold, 0),
    COALESCE(e.vip_tickets_sold, 0)
  INTO
    v_event_capacity,
    v_event_reserved,
    v_standby_enabled,
    v_public_tickets_sold,
    v_vip_tickets_sold
  FROM events e
  WHERE e.id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'event_not_found: Event does not exist';
  END IF;

  IF v_standby_enabled THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'waitlist_closed: Waitlist is closed while standby mode is active';
  END IF;

  SELECT id INTO v_existing_ticket_id
  FROM tickets
  WHERE event_id = p_event_id
    AND email = v_user_email
  LIMIT 1;

  IF v_existing_ticket_id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'already_has_ticket: You already have a ticket for this event';
  END IF;

  IF v_vip_tickets_sold <= v_event_reserved THEN
    v_max_public_capacity := v_event_capacity - v_event_reserved;
  ELSE
    v_max_public_capacity := v_event_capacity - v_vip_tickets_sold;
  END IF;

  v_max_public_capacity := GREATEST(0, v_max_public_capacity);
  v_available_public_tickets := v_max_public_capacity - v_public_tickets_sold;

  IF v_available_public_tickets > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'not_sold_out: Event still has tickets available';
  END IF;

  PERFORM 1
  FROM waitlist
  WHERE event_id = p_event_id
  FOR UPDATE;

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

  SELECT COALESCE(MAX(position), 0) + 1
  INTO v_next_position
  FROM waitlist
  WHERE event_id = p_event_id;

  INSERT INTO waitlist (event_id, email, referral, position, name)
  VALUES (p_event_id, v_user_email, p_referral, v_next_position, p_name)
  RETURNING id INTO v_new_entry_id;

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

REVOKE ALL ON FUNCTION "public"."join_waitlist_with_name"(uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."join_waitlist_with_name"(uuid, text, text, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."join_waitlist_with_name"(uuid, text, text, text) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."join_waitlist_with_name"(uuid, text, text, text) TO "service_role";

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
    COALESCE(e.standby_enabled, false)
  INTO v_event_capacity, v_event_reserved, v_standby_enabled
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
    SELECT id, email, name, referral, position
    INTO
      v_promoted_entry_id,
      v_promoted_email,
      v_promoted_name,
      v_promoted_referral,
      v_promoted_position
    FROM waitlist
    WHERE event_id = p_event_id
    ORDER BY position ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    EXIT WHEN v_promoted_entry_id IS NULL;

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
