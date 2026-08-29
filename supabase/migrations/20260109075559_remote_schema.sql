


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."auto_increment_event_scanned"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- Only increment if ticket wasn't previously scanned
  IF NEW.scanned = true AND (OLD.scanned IS NULL OR OLD.scanned = false) THEN
    UPDATE events 
    SET scanned_count = scanned_count + 1 
    WHERE id = NEW.event_id;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_increment_event_scanned"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_ticket"("p_event_id" "uuid", "p_referral" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."create_ticket"("p_event_id" "uuid", "p_referral" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_suggest_votes_on_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$begin
  update public.suggest
  set votes = greatest(coalesce(votes, 0) - 1, 0)
  where id = old.speaker_id;

  return old;
end;$$;


ALTER FUNCTION "public"."decrement_suggest_votes_on_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_ticket_and_referral"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Decrement tickets count in events table (but don't go below 0)
  UPDATE public.events
  SET tickets = GREATEST(COALESCE(tickets, 0) - 1, 0)
  WHERE id = OLD.event_id;

  -- If ticket had a referral code, decrement referral count
  IF OLD.referral IS NOT NULL AND OLD.referral != '' THEN
    -- Decrement referral count (but don't go below 0)
    UPDATE public.referrals
    SET count = GREATEST(COALESCE(count, 0) - 1, 0)
    WHERE event_id = OLD.event_id
      AND referral_code = OLD.referral;
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."decrement_ticket_and_referral"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_suggest_votes_on_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$begin
  update public.suggest
  set votes = coalesce(votes, 0) + 1
  where id = new.speaker_id;

  return new;
end;$$;


ALTER FUNCTION "public"."increment_suggest_votes_on_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_ticket_and_referral"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_rows_updated INTEGER;
BEGIN
  -- Increment tickets count in events table
  UPDATE public.events
  SET tickets = COALESCE(tickets, 0) + 1
  WHERE id = NEW.event_id;

  -- If ticket has a referral code, increment referral count
  IF NEW.referral IS NOT NULL AND NEW.referral != '' THEN
    -- Update referral count if record exists
    UPDATE public.referrals
    SET count = COALESCE(count, 0) + 1
    WHERE event_id = NEW.event_id
      AND referral_code = NEW.referral;
    
    -- Check if any rows were updated
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    
    -- If no record exists, create one
    IF v_rows_updated = 0 THEN
      INSERT INTO public.referrals (event_id, referral_code, count)
      VALUES (NEW.event_id, NEW.referral, 1);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."increment_ticket_and_referral"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."join_waitlist"("p_event_id" "uuid", "p_referral" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_email TEXT;
  v_next_position INTEGER;
  v_total_count INTEGER;
  v_existing_entry UUID;
  v_new_entry_id UUID;
BEGIN
  -- Get current user's email from JWT claims
  v_user_email := (auth.jwt() ->> 'email');
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  -- Lock all waitlist entries for this event (prevents position collision)
  -- This is similar to how create_ticket locks the event row
  PERFORM 1 FROM waitlist 
  WHERE event_id = p_event_id 
  FOR UPDATE;
  
  -- Check if user already on waitlist
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
  
  -- Calculate next position atomically (while holding lock)
  SELECT COALESCE(MAX(position), 0) + 1 
  INTO v_next_position
  FROM waitlist
  WHERE event_id = p_event_id;
  
  -- Insert new waitlist entry
  INSERT INTO waitlist (
    event_id,
    email,
    referral,
    position
  )
  VALUES (
    p_event_id,
    v_user_email,
    p_referral,
    v_next_position
  )
  RETURNING id INTO v_new_entry_id;
  
  -- Get total count
  SELECT COUNT(*)::INTEGER
  INTO v_total_count
  FROM waitlist
  WHERE event_id = p_event_id;
  
  -- Return success with position info
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_new_entry_id,
    'position', v_next_position,
    'total', v_total_count,
    'email', v_user_email
  );
END;
$$;


ALTER FUNCTION "public"."join_waitlist"("p_event_id" "uuid", "p_referral" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_waitlist"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_email TEXT;
  v_deleted_position INTEGER;
  v_existing_entry UUID;
BEGIN
  -- Get current user's email from JWT claims
  v_user_email := (auth.jwt() ->> 'email');
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  -- Lock all waitlist entries for this event (prevents race conditions during recalculation)
  PERFORM 1 FROM waitlist 
  WHERE event_id = p_event_id 
  FOR UPDATE;
  
  -- Check if user is on waitlist and get their position
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
  
  -- Delete the entry
  DELETE FROM waitlist
  WHERE id = v_existing_entry;
  
  -- Atomically recalculate positions for all users after the deleted position
  -- Decrement position by 1 for everyone after the deleted user
  UPDATE waitlist
  SET position = position - 1
  WHERE event_id = p_event_id
    AND position > v_deleted_position;
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'deleted_position', v_deleted_position,
    'email', v_user_email
  );
END;
$$;


ALTER FUNCTION "public"."leave_waitlist"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."promote_from_waitlist"("p_event_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_promoted_entry RECORD;
  v_promoted_position INTEGER;
BEGIN
  -- Lock all waitlist entries for this event (prevents race conditions)
  -- This ensures atomic position recalculation
  PERFORM 1 FROM waitlist
  WHERE event_id = p_event_id
  FOR UPDATE;

  -- Get the top waitlist entry (lowest position number = first in line)
  SELECT id, email, referral, position
  INTO v_promoted_entry
  FROM waitlist
  WHERE event_id = p_event_id
  ORDER BY position ASC
  LIMIT 1;

  -- If no one is on the waitlist, return null/empty result
  IF v_promoted_entry.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'No one on waitlist'
    );
  END IF;

  -- Store the position for later use
  v_promoted_position := v_promoted_entry.position;

  -- Delete the promoted entry from waitlist
  DELETE FROM waitlist
  WHERE id = v_promoted_entry.id;

  -- Atomically recalculate positions for all remaining users
  -- Decrement position by 1 for everyone after the promoted user
  UPDATE waitlist
  SET position = position - 1
  WHERE event_id = p_event_id
    AND position > v_promoted_position;

  -- Return the promoted user's information for ticket creation
  RETURN jsonb_build_object(
    'success', true,
    'email', v_promoted_entry.email,
    'referral', v_promoted_entry.referral,
    'old_position', v_promoted_position
  );
END;
$$;


ALTER FUNCTION "public"."promote_from_waitlist"("p_event_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."scan_ticket_and_increment_event"("ticket_id" "uuid", "scan_time_val" timestamp with time zone, "scanner_name" "text", "scanner_email" "text") RETURNS TABLE("id" "uuid", "type" "text", "scanned" boolean, "scan_time" timestamp with time zone, "email" "text", "scan_user" "text", "scan_email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  target_event_id uuid;
begin
  -- 1. Update the ticket and capture the event_id (assumes tickets table has event_id)
  update public.tickets
  set 
    scanned = true,
    scan_time = scan_time_val,
    scan_user = scanner_name,
    scan_email = scanner_email
  where tickets.id = ticket_id
  returning event_id into target_event_id;

  -- 2. Increment the scanned count in the events table
  update public.events
  set scanned = coalesce(scanned, 0) + 1
  where events.id = target_event_id;

  -- 3. Return the updated ticket details
  return query
  select t.id, t.type, t.scanned, t.scan_time, t.email, t.scan_user, t.scan_email
  from public.tickets t
  where t.id = ticket_id;
end;
$$;


ALTER FUNCTION "public"."scan_ticket_and_increment_event"("ticket_id" "uuid", "scan_time_val" timestamp with time zone, "scanner_name" "text", "scanner_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_event_scanned_counts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$begin
  update events e
  set scanned = (
      -- This subquery runs for every single event
      -- If no rows are found, COUNT(*) naturally returns 0
      select count(*)
      from tickets t
      where t.event_id = e.id
      and t.scanned = true
  )
  -- The dummy WHERE clause to bypass the "Safe Update" restriction
  where 1=1;
end;$$;


ALTER FUNCTION "public"."sync_event_scanned_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_referral_counts"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$begin
  -- 1. Insert new counts or Update existing ones
  -- We aggregate tickets by event and referral code
  insert into referrals (event_id, referral_code, count)
  select 
    event_id, 
    referral, 
    count(*) as usage_count
  from 
    tickets
  where 
    referral is not null 
    and event_id is not null
  group by 
    event_id, referral
  on conflict (event_id, referral_code) 
  do update set 
    count = excluded.count;

  -- Optional: If you want to set counts to 0 for codes that no longer appear in tickets
  -- (Uncomment the block below if you need this strict sync behavior)
  update referrals r
  set count = 0
  where not exists (
    select 1 from tickets t 
    where t.event_id = r.event_id 
    and t.referral = r.referral_code
  );
  
end;$$;


ALTER FUNCTION "public"."sync_referral_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_votes"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_updated_count INTEGER;
  v_zero_count INTEGER;
BEGIN
  -- Update votes count for suggestions that have votes
  UPDATE public.suggest s
  SET votes = v.cnt
  FROM (
    SELECT speaker_id, count(*)::int as cnt
    FROM public.votes
    GROUP BY speaker_id
  ) v
  WHERE s.id = v.speaker_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Set votes = 0 for suggestions with no votes
  UPDATE public.suggest
  SET votes = 0
  WHERE id NOT IN (SELECT DISTINCT speaker_id FROM public.votes);

  GET DIAGNOSTICS v_zero_count = ROW_COUNT;

  RETURN v_updated_count + v_zero_count;
END;
$$;


ALTER FUNCTION "public"."sync_votes"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "capacity" bigint DEFAULT '0'::bigint NOT NULL,
    "venue" "text",
    "reserved" bigint DEFAULT '0'::bigint NOT NULL,
    "venue_link" "text",
    "release_date" timestamp with time zone,
    "banner" boolean,
    "start_time_date" timestamp with time zone,
    "doors_open" timestamp with time zone,
    "desc" "text",
    "img" "text",
    "route" "text",
    "tagline" "text",
    "tickets" bigint DEFAULT '0'::bigint NOT NULL,
    "live" boolean DEFAULT false NOT NULL,
    "scanned" bigint DEFAULT '0'::bigint NOT NULL,
    "latitude" numeric DEFAULT '0'::numeric NOT NULL,
    "longitude" numeric DEFAULT '0'::numeric NOT NULL,
    "address" "text" DEFAULT ''::"text",
    "img_version" bigint DEFAULT '1'::bigint NOT NULL
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notify" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL,
    "speaker_id" "uuid" NOT NULL
);


ALTER TABLE "public"."notify" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "referral_code" "text",
    "count" bigint DEFAULT '0'::bigint NOT NULL
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "roles" "text"
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suggest" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text",
    "speaker" "text",
    "approved" boolean DEFAULT false NOT NULL,
    "votes" bigint DEFAULT '0'::bigint NOT NULL,
    "reviewed" boolean DEFAULT false NOT NULL,
    "duplicate" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."suggest" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email" "text" NOT NULL,
    "event_id" "uuid",
    "referral" "text",
    "type" "text" DEFAULT 'STANDARD'::"text" NOT NULL,
    "scanned" boolean DEFAULT false NOT NULL,
    "scan_time" timestamp with time zone,
    "scan_user" "text",
    "scan_email" "text"
);


ALTER TABLE "public"."tickets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."votes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "speaker_id" "uuid",
    "email" "text"
);


ALTER TABLE "public"."votes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "referral" "text",
    "event_id" "uuid",
    "email" "text" NOT NULL,
    "position" bigint NOT NULL
);


ALTER TABLE "public"."waitlist" OWNER TO "postgres";


ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notify"
    ADD CONSTRAINT "notify_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suggest"
    ADD CONSTRAINT "requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "unique_event_referral" UNIQUE ("event_id", "referral_code");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "unique_waitlist_per_user" UNIQUE ("event_id", "email");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_email_speaker_unique" UNIQUE ("email", "speaker_id");



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_waitlist_created_at" ON "public"."waitlist" USING "btree" ("event_id", "created_at");



CREATE INDEX "idx_waitlist_event_id" ON "public"."waitlist" USING "btree" ("event_id");



CREATE INDEX "idx_waitlist_position" ON "public"."waitlist" USING "btree" ("event_id", "position");



CREATE INDEX "notify_speaker_id_idx" ON "public"."notify" USING "btree" ("speaker_id");



CREATE INDEX "referrals_event_id_idx" ON "public"."referrals" USING "btree" ("event_id");



CREATE INDEX "suggest_email_idx" ON "public"."suggest" USING "btree" ("email");



CREATE INDEX "suggest_reviewed_idx" ON "public"."suggest" USING "btree" ("reviewed");



CREATE INDEX "suggest_speaker_idx" ON "public"."suggest" USING "btree" ("speaker");



CREATE INDEX "suggest_votes_idx" ON "public"."suggest" USING "btree" ("votes");



CREATE INDEX "tickets_email_idx" ON "public"."tickets" USING "btree" ("email");



CREATE INDEX "tickets_event_id_idx" ON "public"."tickets" USING "btree" ("event_id");



CREATE INDEX "tickets_referral_idx" ON "public"."tickets" USING "btree" ("referral");



CREATE INDEX "tickets_scanned_idx" ON "public"."tickets" USING "btree" ("scanned");



CREATE INDEX "votes_email_idx" ON "public"."votes" USING "btree" ("email");



CREATE INDEX "votes_speaker_id_idx" ON "public"."votes" USING "btree" ("speaker_id");



CREATE OR REPLACE TRIGGER "increment_scanned_on_ticket_update" AFTER UPDATE OF "scanned" ON "public"."tickets" FOR EACH ROW WHEN (("new"."scanned" = true)) EXECUTE FUNCTION "public"."auto_increment_event_scanned"();



CREATE OR REPLACE TRIGGER "ticket_delete_trigger" AFTER DELETE ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_ticket_and_referral"();



CREATE OR REPLACE TRIGGER "ticket_insert_trigger" AFTER INSERT ON "public"."tickets" FOR EACH ROW EXECUTE FUNCTION "public"."increment_ticket_and_referral"();



CREATE OR REPLACE TRIGGER "trg_votes_after_delete" AFTER DELETE ON "public"."votes" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_suggest_votes_on_delete"();



CREATE OR REPLACE TRIGGER "trg_votes_after_insert" AFTER INSERT ON "public"."votes" FOR EACH ROW EXECUTE FUNCTION "public"."increment_suggest_votes_on_insert"();



ALTER TABLE ONLY "public"."notify"
    ADD CONSTRAINT "notify_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "public"."events"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tickets"
    ADD CONSTRAINT "tickets_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."votes"
    ADD CONSTRAINT "votes_speaker_id_fkey" FOREIGN KEY ("speaker_id") REFERENCES "public"."suggest"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."waitlist"
    ADD CONSTRAINT "waitlist_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON UPDATE CASCADE ON DELETE CASCADE;



CREATE POLICY "Enable read access for all users" ON "public"."suggest" FOR SELECT USING (true);



ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notify" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suggest" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."votes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."waitlist" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";





























































































































































































GRANT ALL ON FUNCTION "public"."auto_increment_event_scanned"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_increment_event_scanned"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_increment_event_scanned"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_ticket"("p_event_id" "uuid", "p_referral" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_ticket"("p_event_id" "uuid", "p_referral" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_ticket"("p_event_id" "uuid", "p_referral" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_suggest_votes_on_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_suggest_votes_on_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_suggest_votes_on_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_ticket_and_referral"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_ticket_and_referral"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_ticket_and_referral"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_suggest_votes_on_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_suggest_votes_on_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_suggest_votes_on_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_ticket_and_referral"() TO "anon";
GRANT ALL ON FUNCTION "public"."increment_ticket_and_referral"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_ticket_and_referral"() TO "service_role";



GRANT ALL ON FUNCTION "public"."join_waitlist"("p_event_id" "uuid", "p_referral" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."join_waitlist"("p_event_id" "uuid", "p_referral" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."join_waitlist"("p_event_id" "uuid", "p_referral" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_waitlist"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_waitlist"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_waitlist"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."promote_from_waitlist"("p_event_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."promote_from_waitlist"("p_event_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."promote_from_waitlist"("p_event_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."scan_ticket_and_increment_event"("ticket_id" "uuid", "scan_time_val" timestamp with time zone, "scanner_name" "text", "scanner_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."scan_ticket_and_increment_event"("ticket_id" "uuid", "scan_time_val" timestamp with time zone, "scanner_name" "text", "scanner_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."scan_ticket_and_increment_event"("ticket_id" "uuid", "scan_time_val" timestamp with time zone, "scanner_name" "text", "scanner_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_event_scanned_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_event_scanned_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_event_scanned_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_referral_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_referral_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_referral_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_votes"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_votes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_votes"() TO "service_role";
























GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."notify" TO "anon";
GRANT ALL ON TABLE "public"."notify" TO "authenticated";
GRANT ALL ON TABLE "public"."notify" TO "service_role";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."suggest" TO "anon";
GRANT ALL ON TABLE "public"."suggest" TO "authenticated";
GRANT ALL ON TABLE "public"."suggest" TO "service_role";



GRANT ALL ON TABLE "public"."tickets" TO "anon";
GRANT ALL ON TABLE "public"."tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."tickets" TO "service_role";



GRANT ALL ON TABLE "public"."votes" TO "anon";
GRANT ALL ON TABLE "public"."votes" TO "authenticated";
GRANT ALL ON TABLE "public"."votes" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist" TO "anon";
GRANT ALL ON TABLE "public"."waitlist" TO "authenticated";
GRANT ALL ON TABLE "public"."waitlist" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































