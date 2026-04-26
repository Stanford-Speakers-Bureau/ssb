import type { UserSuggestion } from "./data";

type UserSuggestionsPanelProps = {
  userSuggestions: UserSuggestion[];
  isLoggedIn: boolean;
};

export default function UserSuggestionsPanel({
  userSuggestions,
  isLoggedIn,
}: UserSuggestionsPanelProps) {
  if (!isLoggedIn) {
    return (
      <p className="font-sans text-sm text-zinc-500">
        Sign in to see the speakers you&rsquo;ve suggested.
      </p>
    );
  }
  if (userSuggestions.length === 0) {
    return (
      <p className="font-sans text-sm text-zinc-500">
        You haven&rsquo;t suggested anyone yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {userSuggestions.map((s) => {
        let statusLabel = "Pending review";
        let statusClass = "text-amber-300 bg-amber-950/40";

        if (s.approved && s.spoke) {
          statusLabel = "Spoke at SSB";
          statusClass = "text-sky-300 bg-sky-950/40";
        } else if (s.approved) {
          statusLabel = "On leaderboard";
          statusClass = "text-green-300 bg-green-950/40";
        } else if (s.reviewed && !s.approved) {
          if (s.duplicate) {
            statusLabel = "Duplicate";
            statusClass = "text-amber-300 bg-amber-950/40";
          } else {
            statusLabel = "Not selected";
            statusClass = "text-zinc-400 bg-zinc-900";
          }
        }

        return (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-[var(--ssb-card)] px-4 py-3"
          >
            <span className="font-sans text-sm text-white truncate">
              {s.speaker}
            </span>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${statusClass}`}
            >
              {statusLabel}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
