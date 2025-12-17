-- RPC Function: sync_votes
-- Resyncs vote counts in the suggest table based on actual votes in the votes table
-- 
-- Usage:
--   Supabase JS: await supabase.rpc('sync_votes')
--
-- This function:
-- - Updates votes count for all suggestions that have votes
-- - Sets votes = 0 for suggestions with no votes
-- - Returns the number of suggestions updated

CREATE OR REPLACE FUNCTION sync_votes()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Grant execute permission to authenticated users (admin-only via API route)
-- GRANT EXECUTE ON FUNCTION sync_votes() TO authenticated;

