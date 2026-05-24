import type { UserEventQuestion } from "./data";

type Props = {
  userQuestions: UserEventQuestion[];
  isLoggedIn: boolean;
};

export default function UserQuestionsPanel({
  userQuestions,
  isLoggedIn,
}: Props) {
  if (!isLoggedIn || userQuestions.length === 0) return null;
  return (
    <ul className="space-y-2">
      {userQuestions.map((q) => {
        let label = "Pending review";
        let cls = "text-amber-300 bg-amber-950/40";

        if (q.hidden) {
          label = "Hidden";
          cls = "text-zinc-400 bg-zinc-900";
        } else if (q.approved) {
          label = "Live";
          cls = "text-green-300 bg-green-950/40";
        } else if (q.reviewed && !q.approved) {
          label = q.duplicate ? "Duplicate" : "Not selected";
          cls = q.duplicate
            ? "text-amber-300 bg-amber-950/40"
            : "text-zinc-400 bg-zinc-900";
        }

        return (
          <li
            key={q.id}
            className="flex flex-col gap-2 rounded-xl border border-[var(--ssb-border)] bg-[var(--ssb-card)] px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-sans text-sm text-[var(--ssb-ink-strong)] leading-snug">
                {q.question}
              </p>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${cls}`}
              >
                {label}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
