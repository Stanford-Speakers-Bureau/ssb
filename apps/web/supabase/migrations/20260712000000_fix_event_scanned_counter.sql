-- Keep both the current and legacy event scan counters in sync whenever a
-- ticket's scanned state changes. The original trigger only incremented the
-- legacy scanned_count column and did not handle an admin unscan.
CREATE OR REPLACE FUNCTION public.auto_increment_event_scanned()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
DECLARE
  counter_delta bigint;
BEGIN
  counter_delta := CASE WHEN NEW.scanned THEN 1 ELSE -1 END;

  UPDATE public.events
  SET
    scanned = GREATEST(0, scanned + counter_delta),
    scanned_count = GREATEST(0, scanned_count + counter_delta)
  WHERE id = NEW.event_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS increment_scanned_on_ticket_update ON public.tickets;

CREATE TRIGGER increment_scanned_on_ticket_update
AFTER UPDATE OF scanned ON public.tickets
FOR EACH ROW
WHEN (OLD.scanned IS DISTINCT FROM NEW.scanned)
EXECUTE FUNCTION public.auto_increment_event_scanned();
