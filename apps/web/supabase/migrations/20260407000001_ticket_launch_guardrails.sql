WITH ranked_tickets AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY event_id, email
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM public.tickets
  WHERE event_id IS NOT NULL
)
DELETE FROM public.tickets
WHERE ctid IN (
  SELECT ctid
  FROM ranked_tickets
  WHERE duplicate_rank > 1
);

CREATE INDEX IF NOT EXISTS "events_route_idx"
  ON "public"."events" USING "btree" ("route");

CREATE INDEX IF NOT EXISTS "tickets_event_type_idx"
  ON "public"."tickets" USING "btree" ("event_id", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "tickets_event_email_unique"
  ON "public"."tickets" USING "btree" ("event_id", "email");
