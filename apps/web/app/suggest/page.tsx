import type { Metadata } from "next";
import { getSessionUser } from "@/app/lib/auth";
import Leaderboard from "./Leaderboard";
import SuggestHero from "./SuggestHero";
import SubmitPanel from "./SubmitPanel";
import UserSuggestionsPanel from "./UserSuggestionsPanel";
import { getLeaderboardData, getUserSuggestions } from "./data";

export const metadata: Metadata = {
  title: "Suggest a Speaker",
  description:
    "Suggest a speaker you'd love to see at Stanford. Vote on community suggestions and help shape future events.",
  openGraph: {
    title: "Who should speak at Stanford?",
    description:
      "Submit names. Vote on others. Top picks become the leads we chase.",
    type: "website",
    siteName: "Stanford Speakers Bureau",
    url: "/suggest",
  },
  twitter: {
    card: "summary_large_image",
    title: "Who should speak at Stanford?",
    description:
      "Submit names. Vote on others. Top picks become the leads we chase.",
  },
};

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

        <section className="relative bg-zinc-950 border-t border-zinc-900 py-16 sm:py-24 px-6 sm:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#ff7766] mb-3">
                The Leaderboard
              </p>
              <h2 className="font-serif text-3xl sm:text-5xl text-white leading-[0.95]">
                Who the community wants next
              </h2>
              <p className="font-sans text-base text-zinc-400 max-w-lg mx-auto mt-4">
                Ranked by votes. Tap the upvote to move a name up the list.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-10 lg:gap-12 items-start">
              <div>
                <Leaderboard
                  suggestions={leaderboardData}
                  isLoggedIn={!!user}
                />
              </div>

              <aside className="lg:sticky lg:top-28 space-y-10">
                <SubmitPanel user={user} signInRedirect="/suggest" />

                <div>
                  <div className="flex items-center gap-4 mb-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-[#ff7766]">
                      Your suggestions
                    </p>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                  <p className="font-sans text-xs text-zinc-400 mb-4 leading-relaxed">
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
