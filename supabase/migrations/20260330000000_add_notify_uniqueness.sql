WITH ranked_notify AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY email, speaker_id
      ORDER BY created_at ASC, id ASC
    ) AS duplicate_rank
  FROM public.notify
)
DELETE FROM public.notify
WHERE ctid IN (
  SELECT ctid
  FROM ranked_notify
  WHERE duplicate_rank > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS "notify_email_speaker_unique"
ON "public"."notify" USING "btree" ("email", "speaker_id");
