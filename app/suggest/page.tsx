import type { Metadata } from "next";
import { getSessionUser } from "@/app/lib/auth";
import { db, eq, suggest, votes } from "@ssb/db";
import Link from "next/link";
import SuggestForm from "./SuggestForm";
import Leaderboard from "./Leaderboard";
import SuggestHero from "./SuggestHero";

export const metadata: Metadata = {
  title: "Suggest a Speaker",
  description:
    "Suggest a speaker you'd love to see at Stanford. Vote on community suggestions and help shape future events.",
};

type Suggestion = {
  id: string;
  speaker: string;
  votes: number;
  hasVoted: boolean;
};

type UserSuggestion = {
  id: string;
  speaker: string;
  approved: boolean;
  reviewed: boolean;
  duplicate?: boolean;
};

function getUserInitials(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "";

  if (!source) return "SS";

  if (source.includes("@")) {
    return source.slice(0, 2).toUpperCase();
  }

  const initials = source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "SS";
}

async function getLeaderboardData(
  userEmail: string | null,
): Promise<Suggestion[]> {
  const suggestions = await db.query.suggest.findMany({
    where: eq(suggest.approved, true),
    columns: { id: true, speaker: true, votes: true },
    orderBy: (suggest, { desc }) => [desc(suggest.votes)],
  });

  let userVotes: Set<string> = new Set();
  if (userEmail) {
    const userVoteRows = await db.query.votes.findMany({
      where: eq(votes.email, userEmail),
      columns: { speakerId: true },
    });
    userVotes = new Set(
      userVoteRows.map((v) => v.speakerId).filter(Boolean) as string[],
    );
  }

  return suggestions.map((s) => ({
    id: s.id,
    speaker: s.speaker || "",
    votes: s.votes || 0,
    hasVoted: userVotes.has(s.id),
  }));
}

async function getUserSuggestions(
  userEmail: string | null,
): Promise<UserSuggestion[]> {
  if (!userEmail) return [];

  const data = await db.query.suggest.findMany({
    where: eq(suggest.email, userEmail),
    columns: {
      id: true,
      speaker: true,
      approved: true,
      reviewed: true,
      duplicate: true,
    },
    orderBy: (suggest, { desc }) => [desc(suggest.createdAt)],
  });

  return data.map((s) => ({
    id: s.id,
    speaker: s.speaker || "",
    approved: !!s.approved,
    reviewed: !!s.reviewed,
    duplicate: !!s.duplicate,
  }));
}

function UserSuggestionsPanel({
  userSuggestions,
  isLoggedIn,
}: {
  userSuggestions: UserSuggestion[];
  isLoggedIn: boolean;
}) {
  if (!isLoggedIn) {
    return (
      <p className="font-sans text-sm text-zinc-500 dark:text-zinc-500">
        Sign in to see the speakers you&rsquo;ve suggested.
      </p>
    );
  }
  if (userSuggestions.length === 0) {
    return (
      <p className="font-sans text-sm text-zinc-500 dark:text-zinc-500">
        You haven&rsquo;t suggested anyone yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {userSuggestions.map((s) => {
        let statusLabel = "Pending review";
        let statusClass =
          "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300";

        if (s.approved) {
          statusLabel = "On leaderboard";
          statusClass =
            "text-green-700 bg-green-50 dark:bg-green-950/40 dark:text-green-300";
        } else if (s.reviewed && !s.approved) {
          if (s.duplicate) {
            statusLabel = "Duplicate";
            statusClass =
              "text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300";
          } else {
            statusLabel = "Not selected";
            statusClass =
              "text-zinc-600 bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-400";
          }
        }

        return (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 dark:border-zinc-900 bg-white dark:bg-black px-4 py-3"
          >
            <span className="font-sans text-sm text-zinc-900 dark:text-white truncate">
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

const STEPS: { num: string; title: string; body: string }[] = [
  {
    num: "01",
    title: "Submit",
    body: "Add the names of anyone you'd like to see speak at Stanford. You can add several in one go.",
  },
  {
    num: "02",
    title: "Vote",
    body: "Browse the leaderboard and upvote suggestions you'd pay to attend. Every Stanford account gets one vote per name.",
  },
  {
    num: "03",
    title: "We chase",
    body: "Each Sunday we look at who's climbing. Top picks become the outreach list for our booking team.",
  },
];

export default async function SuggestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();

  const resolvedSearchParams = await searchParams;
  const authError = resolvedSearchParams.error === "auth_failed";

  const userName = user?.displayName || null;
  const userInitials = getUserInitials(userName, user?.email || null);

  const [leaderboardData, userSuggestions] = await Promise.all([
    getLeaderboardData(user?.email || null),
    getUserSuggestions(user?.email || null),
  ]);

  const totalVotes = leaderboardData.reduce((acc, s) => acc + s.votes, 0);
  const totalSuggestions = leaderboardData.length;
  const topNames = leaderboardData
    .slice(0, 24)
    .map((s) => s.speaker)
    .filter(Boolean);

  return (
    <div className="flex min-h-screen flex-col bg-white font-sans dark:bg-black">
      {authError && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 p-3 rounded text-sm font-medium text-red-800 bg-red-50 dark:bg-red-950/80 dark:text-red-300 shadow-lg border border-red-200 dark:border-red-900"
          role="alert"
        >
          Authentication failed. Please try signing in again.
        </div>
      )}

      <main className="flex w-full flex-col">
        <SuggestHero
          topNames={topNames}
          totalSuggestions={totalSuggestions}
          totalVotes={totalVotes}
        />

        <section className="relative bg-white dark:bg-black border-t border-zinc-200 dark:border-zinc-900 py-16 sm:py-24 px-6 sm:px-12">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-start">
            <div>
              <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-4">
                The Shortlist
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-zinc-900 dark:text-white leading-[0.95] mb-6">
                Our next speaker starts with a name on this list.
              </h2>
              <p className="font-sans text-base sm:text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed mb-10 max-w-xl">
                SSB books dozens of speakers a year. We only get there because
                the Stanford community tells us who they actually want to hear.
                Drop a name below and we&rsquo;ll take it from there.
              </p>

              <ol className="space-y-7">
                {STEPS.map((step) => (
                  <li
                    key={step.num}
                    className="grid grid-cols-[auto_1fr] gap-5 sm:gap-6"
                  >
                    <span className="font-serif text-4xl sm:text-5xl text-[#A80D0C] leading-none">
                      {step.num}
                    </span>
                    <div>
                      <h3 className="font-serif text-xl sm:text-2xl text-zinc-900 dark:text-white mb-1.5">
                        {step.title}
                      </h3>
                      <p className="font-sans text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="lg:sticky lg:top-28">
              {user ? (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-6 sm:p-8 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-[#A80D0C] mb-2">
                    Submit
                  </p>
                  <h3 className="font-serif text-2xl sm:text-3xl text-zinc-900 dark:text-white mb-5 leading-tight">
                    Add a name to the list
                  </h3>
                  <div className="flex items-center gap-3 mb-6 pb-5 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="w-9 h-9 rounded-full bg-[#A80D0C] flex items-center justify-center text-xs font-semibold text-white">
                      {userInitials}
                    </div>
                    <div className="text-xs leading-tight">
                      <p className="text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">
                        Signed in as
                      </p>
                      <p className="text-zinc-900 dark:text-white font-medium truncate max-w-[220px] mt-0.5">
                        {userName || user?.email}
                      </p>
                    </div>
                  </div>
                  <SuggestForm />
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-8 text-center shadow-sm">
                  <p className="text-xs uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
                    Sign in required
                  </p>
                  <h3 className="font-serif text-2xl text-zinc-900 dark:text-white mb-3 leading-tight">
                    Use your Stanford account to suggest and vote
                  </h3>
                  <p className="font-sans text-sm text-zinc-600 dark:text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
                    One account, one vote. Takes a few seconds through Stanford
                    SSO.
                  </p>
                  <Link
                    href="/api/auth/login?redirect_to=/suggest"
                    prefetch={false}
                    className="inline-flex items-center gap-2 rounded-full bg-[#A80D0C] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211]"
                  >
                    Sign in with Stanford
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
              )}
            </div>
          </div>
        </section>

        <section className="relative bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-900 py-16 sm:py-24 px-6 sm:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
                The Leaderboard
              </p>
              <h2 className="font-serif text-3xl sm:text-5xl text-zinc-900 dark:text-white leading-[0.95]">
                Who the community wants next
              </h2>
              <p className="font-sans text-base text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto mt-4">
                Ranked by votes. Tap the upvote to move a name up the list.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-10 lg:gap-12">
              <div>
                <Leaderboard
                  suggestions={leaderboardData}
                  isLoggedIn={!!user}
                />
              </div>

              <aside>
                <div className="lg:sticky lg:top-28">
                  <div className="flex items-center gap-4 mb-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-[#A80D0C]">
                      Your suggestions
                    </p>
                    <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                  </div>
                  <p className="font-sans text-xs text-zinc-500 dark:text-zinc-500 mb-4 leading-relaxed">
                    New suggestions take a little time to be reviewed before
                    they appear on the leaderboard.
                  </p>
                  <UserSuggestionsPanel
                    userSuggestions={userSuggestions}
                    isLoggedIn={!!user}
                  />
                </div>
              </aside>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
