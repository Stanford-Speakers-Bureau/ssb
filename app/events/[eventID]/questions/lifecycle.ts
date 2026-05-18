export type QuestionsLifecycleState = "open" | "closed";

type LifecycleEvent = {
  doors_open?: string | Date | null;
  doorsOpen?: string | Date | null;
  start_time_date?: string | Date | null;
  startTimeDate?: string | Date | null;
  questions_enabled?: boolean | null;
  questionsEnabled?: boolean | null;
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Question voting is "open" by default for announced events. It closes when:
 * - the admin disabled questions for this event (`questions_enabled = false`)
 * - or doors have opened (falls back to start_time_date if doors_open is null)
 *
 * Unannounced events never reach this code path — the event page renders the
 * mystery view and the /questions route 404s before lifecycle is consulted.
 */
export function getQuestionsLifecycleState(
  event: LifecycleEvent,
  now: Date = new Date(),
): QuestionsLifecycleState {
  const enabled = event.questions_enabled ?? event.questionsEnabled ?? true;
  if (!enabled) return "closed";

  const doorsOpen =
    toDate(event.doors_open ?? event.doorsOpen) ??
    toDate(event.start_time_date ?? event.startTimeDate);

  if (doorsOpen && now >= doorsOpen) return "closed";
  return "open";
}
