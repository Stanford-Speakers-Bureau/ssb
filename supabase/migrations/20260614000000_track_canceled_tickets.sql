-- Track canceled tickets.
--
-- Canceling a ticket hard-deletes the `tickets` row (see cancel_ticket_and_promote
-- below), so the live table keeps no record of who bought-then-bailed. That makes
-- "show-up rate by purchase timing" silently drop cancellations: a canceled
-- ticket is neither in the denominator nor counted as a no-show.
--
-- This migration:
--   1. Adds a `canceled_tickets` archive that snapshots the row (original
--      purchase time + cancel time) before it is deleted. It is write-only from
--      the cancel path and read only by analytics, so no capacity / scan / email
--      query has to learn about it — same containment as wallet_voided_passes.
--   2. Rewrites cancel_ticket_and_promote to insert that snapshot in the same
--      transaction as the delete. Both the admin and web cancel handlers call
--      this one function, so both paths are covered.
--   3. Backfills the archive from historical `ticket.cancel` audit logs, so the
--      table isn't blind to every cancellation that happened before it existed.

CREATE TABLE IF NOT EXISTS "public"."canceled_tickets" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- id of the now-deleted tickets row. Not a FK (the row is gone); unique so a
  -- re-run of the audit-log backfill can't duplicate a cancellation.
  "original_ticket_id"  uuid,
  "event_id"            uuid REFERENCES "public"."events"("id")
                          ON UPDATE CASCADE ON DELETE CASCADE,
  "email"               text NOT NULL,
  "name"                text,
  "type"                text,
  "referral"            text,
  -- When the ticket was originally purchased — the x-axis for purchase timing.
  "created_at"          timestamptz NOT NULL,
  -- When it was canceled.
  "canceled_at"         timestamptz NOT NULL DEFAULT now(),
  -- 'live' = captured by the cancel RPC; 'backfill' = reconstructed from audit logs.
  "source"              text NOT NULL DEFAULT 'live'
);

CREATE INDEX IF NOT EXISTS "canceled_tickets_event_id_idx"
  ON "public"."canceled_tickets" ("event_id");
CREATE INDEX IF NOT EXISTS "canceled_tickets_created_at_idx"
  ON "public"."canceled_tickets" ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "canceled_tickets_original_ticket_id_unique"
  ON "public"."canceled_tickets" ("original_ticket_id");

-- Rewritten cancel RPC: identical to the prior (fee_waiver) version except it
-- snapshots the row into canceled_tickets before the DELETE. Lines that differ
-- from the previous definition are marked "-- NEW". The 'cancelled_ticket_id'
-- return key keeps its existing spelling — both cancel handlers read it.
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
  v_ticket_type TEXT;             -- NEW
  v_ticket_name TEXT;            -- NEW
  v_ticket_referral TEXT;        -- NEW
  v_ticket_created_at TIMESTAMPTZ; -- NEW
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

  -- NEW: snapshot the full row (not just id/scanned) so we can archive it.
  SELECT id, scanned, type, name, referral, created_at
  INTO
    v_ticket_id,
    v_ticket_scanned,
    v_ticket_type,
    v_ticket_name,
    v_ticket_referral,
    v_ticket_created_at
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

  -- NEW: archive before deleting. Same transaction, so the snapshot and the
  -- delete commit together or roll back together.
  INSERT INTO canceled_tickets (
    original_ticket_id, event_id, email, name, type, referral, created_at, source
  ) VALUES (
    v_ticket_id, p_event_id, v_user_email, v_ticket_name, v_ticket_type,
    v_ticket_referral, v_ticket_created_at, 'live'
  )
  ON CONFLICT (original_ticket_id) DO NOTHING;

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

-- Backfill from historical cancellations.
--
-- Every cancel (web + admin) writes a `ticket.cancel` audit row whose metadata
-- JSON carries the deleted ticket's id (`ticketId`) and its original purchase
-- time (`gotTicketAt`); the row's own `created_at` is when the cancel happened.
-- That's enough to reconstruct a purchase-timing snapshot. name / type /
-- referral were never captured at cancel time, so they stay NULL — analytics
-- that only need timing don't read them.
--
-- Skips:
--   * rows with no `gotTicketAt` (older logs) — without the original purchase
--     time they can't sit on the timing x-axis, and inventing one would skew it;
--   * rows with no `ticketId` — there'd be nothing to dedupe on.
-- DISTINCT ON keeps one row per ticket (the earliest cancel) so the statement
-- can't self-conflict, and ON CONFLICT defers to anything the live RPC already
-- archived. event_id is kept only when the event still exists, since the FK
-- (matching the live table) would reject an id whose event has been deleted.
INSERT INTO canceled_tickets (
  original_ticket_id, event_id, email, name, type, referral,
  created_at, canceled_at, source
)
SELECT DISTINCT ON (src.original_ticket_id)
  src.original_ticket_id,
  src.event_id,
  src.email,
  NULL,
  NULL,
  NULL,
  src.created_at,
  src.canceled_at,
  'backfill'
FROM (
  SELECT
    (a.metadata::jsonb ->> 'ticketId')::uuid              AS original_ticket_id,
    e.id                                                  AS event_id,
    lower(trim(a.target_email))                           AS email,
    (a.metadata::jsonb ->> 'gotTicketAt')::timestamptz    AS created_at,
    a.created_at                                          AS canceled_at
  FROM audit_logs a
  LEFT JOIN events e ON e.id = a.event_id
  WHERE a.action = 'ticket.cancel'
    AND a.target_email IS NOT NULL
    AND a.metadata IS NOT NULL
    AND (a.metadata::jsonb ->> 'ticketId') IS NOT NULL
    AND (a.metadata::jsonb ->> 'gotTicketAt') IS NOT NULL
) AS src
ORDER BY src.original_ticket_id, src.canceled_at ASC
ON CONFLICT (original_ticket_id) DO NOTHING;
