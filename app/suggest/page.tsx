import type { Metadata } from "next";
import { getSessionUser } from "@/app/lib/auth";
import Link from "next/link";
import Leaderboard from "./Leaderboard";
import SuggestHero from "./SuggestHero";
import SubmitPanel from "./SubmitPanel";
import UserSuggestionsPanel from "./UserSuggestionsPanel";
import { getLeaderboardData, getUserSuggestions } from "./data";

export const metadata: Metadata = {
  title: "Suggest a Speaker",
  description:
    "Suggest a speaker you'd love to see at Stanford. Vote on community suggestions and help shape future events.",
};

const STEPS: { num: string; title: string; body: React.ReactNode }[] = [
  {
    num: "01",
    title: "Submit",
    body: "Add the names of anyone you'd like to see speak at Stanford.",
  },
  {
    num: "02",
    title: "Vote",
    body: "Browse the leaderboard and upvote suggestions you'd love to see speak at Stanford.",
  },
  {
    num: "03",
    title: "We chase",
    body: (
      <>
        Each Monday we look at who&rsquo;s climbing. Top picks become the
        outreach list for our booking team.{" "}
        <Link
          href="/join"
          prefetch={false}
          className="font-semibold text-white underline underline-offset-4 decoration-[#A80D0C]/60 hover:decoration-[#A80D0C] transition-colors"
        >
          Want to join?
        </Link>
      </>
    ),
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
    <div className="flex min-h-screen flex-col bg-[var(--ssb-paper)] font-sans">
      {authError && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 p-3 rounded text-sm font-medium text-red-300 bg-red-950/80 shadow-lg border border-red-900"
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

        <section className="relative bg-[var(--ssb-paper)] border-t border-zinc-900 py-16 sm:py-24 px-6 sm:px-12">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-start">
            <div>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-white leading-[0.95] mb-6">
                Our next speaker starts with a name on this list.
              </h2>
              <p className="font-sans text-base sm:text-lg text-zinc-400 leading-relaxed mb-10 max-w-xl">
                We only get there because the Stanford community tells us who they actually want to hear.
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
                      <h3 className="font-serif text-xl sm:text-2xl text-white mb-1.5">
                        {step.title}
                      </h3>
                      <p className="font-sans text-sm text-zinc-400 leading-relaxed max-w-md">
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <div className="lg:sticky lg:top-28">
              <SubmitPanel user={user} signInRedirect="/suggest" />
            </div>
          </div>
        </section>

        <section className="relative bg-zinc-950 border-t border-zinc-900 py-16 sm:py-24 px-6 sm:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
                The Leaderboard
              </p>
              <h2 className="font-serif text-3xl sm:text-5xl text-white leading-[0.95]">
                Who the community wants next
              </h2>
              <p className="font-sans text-base text-zinc-400 max-w-lg mx-auto mt-4">
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
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                  <p className="font-sans text-xs text-zinc-500 mb-4 leading-relaxed">
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
