import Link from "next/link";
import QuestionForm from "./QuestionForm";
import type { QuestionsLifecycleState } from "./lifecycle";

type Props = {
  user: {
    email?: string | null;
    displayName?: string | null;
  } | null;
  eventId: string;
  eventRoute: string;
  lifecycleState: QuestionsLifecycleState;
};

function initialsFrom(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "SS";
  if (source.includes("@")) return source.slice(0, 2).toUpperCase();
  return (
    source
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "SS"
  );
}

export default function QuestionSubmitPanel({
  user,
  eventId,
  eventRoute,
  lifecycleState,
}: Props) {
  const closed = lifecycleState !== "open";

  if (user) {
    const initials = initialsFrom(user.displayName ?? null, user.email ?? null);
    return (
      <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/50 shadow-lg p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="shrink-0 w-8 h-8 rounded-full bg-[#A80D0C] flex items-center justify-center text-[11px] font-semibold text-white">
            {initials}
          </div>
          <p className="text-xs text-zinc-400 truncate">
            {user.displayName || user.email}
          </p>
        </div>
        {closed ? (
          <p className="rounded-xl border border-zinc-800/70 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
            Submissions closed.
          </p>
        ) : (
          <QuestionForm eventId={eventId} />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800/70 bg-zinc-900/50 shadow-lg p-6 text-center">
      <Link
        href={`/api/auth/login?redirect_to=${encodeURIComponent(
          `/events/${eventRoute}/questions`,
        )}`}
        prefetch={false}
        className="inline-flex items-center gap-2 rounded-full bg-[#A80D0C] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211]"
      >
        Sign in to suggest
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
