-- Stanford SSO user profile storage and auth-independent RPCs

CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "last_sign_in_at" timestamp with time zone NOT NULL DEFAULT now(),
  "email" text NOT NULL,
  "uid" text,
  "display_name" text NOT NULL,
  "edu_person_affiliation" text[] NOT NULL DEFAULT '{}'::text[],
  "edu_person_scoped_affiliation" text[] NOT NULL DEFAULT '{}'::text[]
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_email_unique"
  ON "public"."user_profiles" ("email");

CREATE OR REPLACE FUNCTION "public"."set_user_profiles_updated_at"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "set_user_profiles_updated_at" ON "public"."user_profiles";

CREATE TRIGGER "set_user_profiles_updated_at"
BEFORE UPDATE ON "public"."user_profiles"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_user_profiles_updated_at"();

ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."user_profiles" FROM PUBLIC;
REVOKE ALL ON TABLE "public"."user_profiles" FROM "anon";
REVOKE ALL ON TABLE "public"."user_profiles" FROM "authenticated";

GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";

DROP POLICY IF EXISTS "service_role_can_manage_user_profiles" ON "public"."user_profiles";

CREATE POLICY "service_role_can_manage_user_profiles"
ON "public"."user_profiles"
FOR ALL
TO "service_role"
USING (true)
WITH CHECK (true);

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
  v_event_capacity INTEGER;
  v_event_reserved INTEGER;
  v_public_tickets_sold BIGINT;
  v_vip_tickets_sold BIGINT;
  v_available_public_tickets INTEGER;
  v_max_public_capacity INTEGER;
  v_existing_ticket_id UUID;
  v_new_ticket_id UUID;
BEGIN
  v_user_email := NULLIF(lower(trim(p_email)), '');

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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

  SELECT COUNT(*)::BIGINT
  INTO v_public_tickets_sold
  FROM tickets
  WHERE event_id = p_event_id
    AND (type = 'STANDARD' OR type IS NULL);

  SELECT COUNT(*)::BIGINT
  INTO v_vip_tickets_sold
  FROM tickets
  WHERE event_id = p_event_id
    AND type = 'VIP';

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
  v_next_position INTEGER;
  v_total_count INTEGER;
  v_existing_entry UUID;
  v_new_entry_id UUID;
BEGIN
  v_user_email := NULLIF(lower(trim(p_email)), '');

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM 1 FROM events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'event_not_found: Event does not exist';
  END IF;

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

CREATE OR REPLACE FUNCTION "public"."leave_waitlist"(
  "p_event_id" uuid,
  "p_email" text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_email TEXT;
  v_deleted_position INTEGER;
  v_existing_entry UUID;
BEGIN
  v_user_email := NULLIF(lower(trim(p_email)), '');

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

REVOKE ALL ON FUNCTION "public"."leave_waitlist"(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."leave_waitlist"(uuid, text) FROM "anon";
REVOKE ALL ON FUNCTION "public"."leave_waitlist"(uuid, text) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."leave_waitlist"(uuid, text) TO "service_role";
