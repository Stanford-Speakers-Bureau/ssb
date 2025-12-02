import { createServerSupabaseClient, getSupabaseClient } from "../lib/supabase";
import Image from "next/image";
import Link from "next/link";
import SuggestForm from "./SuggestForm";
import Leaderboard from "./Leaderboard";

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
};

async function getLeaderboardData(userEmail: string | null): Promise<Suggestion[]> {
  const supabase = getSupabaseClient();
  
  // Get approved suggestions sorted by votes
  const { data: suggestions, error } = await supabase
    .from("suggest")
    .select("id, speaker, votes")
    .eq("approved", true)
    .order("votes", { ascending: false });

  if (error || !suggestions) {
    console.error("Error fetching suggestions:", error);
    return [];
  }

  // If user is logged in, check which ones they've voted for
  let userVotes: Set<string> = new Set();
  if (userEmail) {
    const { data: votes } = await supabase
      .from("votes")
      .select("speaker_id")
      .eq("email", userEmail);

    if (votes) {
      userVotes = new Set(votes.map(v => v.speaker_id));
    }
  }

  return suggestions.map(s => ({
    id: s.id,
    speaker: s.speaker || "",
    votes: s.votes || 0,
    hasVoted: userVotes.has(s.id),
  }));
}

async function getUserSuggestions(userEmail: string | null): Promise<UserSuggestion[]> {
  if (!userEmail) return [];

  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from("suggest")
    .select("id, speaker, approved, reviewed")
    .eq("email", userEmail)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching user suggestions:", error);
    return [];
  }

  return data.map(s => ({
    id: s.id,
    speaker: s.speaker || "",
    approved: !!s.approved,
    reviewed: !!s.reviewed,
  }));
}

export default async function SuggestPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user metadata from Google OAuth
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  // Fetch leaderboard and user suggestion data on the server
  const [leaderboardData, userSuggestions] = await Promise.all([
    getLeaderboardData(user?.email || null),
    getUserSuggestions(user?.email || null),
  ]);

  return (
    <div className="flex h-[calc(100vh-2.5rem)] flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 bg-white dark:bg-black pt-16">
        {/* Desktop Layout - Centered leaderboard + right column */}
        <div className="hidden lg:flex flex-1 justify-center items-start">
          <section className="w-full max-w-5xl flex items-start justify-center lg:py-8 py-6 px-6 sm:px-12 md:px-16">
            {/* Leaderboard on the left */}
            <div className="flex-1 max-w-lg mx-0">
              <Leaderboard
                suggestions={leaderboardData}
                isLoggedIn={!!user}
                userSuggestions={userSuggestions}
              />
            </div>

            {/* Right column: Suggest a Speaker + Your suggested speakers */}
            <aside className="w-96 space-y-4">
              {/* Suggest a Speaker */}
              <section className="bg-white dark:bg-black p-4 pt-2 rounded-lg">
                <h2 className="text-xl font-bold text-black dark:text-white mb-3 font-serif">
                  Suggest a Speaker
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-3 text-sm leading-relaxed">
                  Have someone you&apos;d love to see speak at Stanford? Submit your suggestion!
                </p>
                
                {user ? (
                  <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-4">
                      {userAvatar ? (
                        <Image
                          src={userAvatar}
                          alt={userName || "Profile"}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-[#A80D0C] flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <div className="text-xs">
                        <p className="text-zinc-500 dark:text-zinc-400">Signed in as</p>
                        <p className="text-black dark:text-white font-medium truncate max-w-[200px]">
                          {userName || user?.email}
                        </p>
                      </div>
                    </div>
                    
                    <SuggestForm />
                  </div>
                ) : (
                  <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-black dark:text-white mb-1">
                      Sign in to suggest
                    </h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs mb-4">
                      Use your Stanford Google account
                    </p>
                    <Link
                      href="/api/auth/google?redirect_to=/suggest"
                      prefetch={false}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm
                                 bg-[#A80D0C] hover:bg-[#8a0b0a] transition-all shadow-md hover:shadow-lg"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Sign in with Google
                    </Link>
                  </div>
                )}
              </section>

              {/* Your suggested speakers below the suggest card */}
              <section className="bg-white dark:bg-black p-4 rounded-lg">
                <h2 className="text-xl font-bold text-black dark:text-white mb-2 font-serif">
                  Your Suggested Speakers
                </h2>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3">
                  These are the speakers you&apos;ve submitted. New suggestions may take a little time
                  to be reviewed before they appear.
                </p>

                {user ? (
                  userSuggestions.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      You haven&apos;t suggested anyone yet.
                    </p>
                  ) : (
                    <ul className="space-y-2 pr-1">
                      {userSuggestions.map(s => {
                        let statusLabel = "Pending review";
                        let statusClass = "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20";

                        if (s.approved) {
                          statusLabel = "On leaderboard";
                          statusClass = "text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20";
                        } else if (s.reviewed && !s.approved) {
                          statusLabel = "Rejected";
                          statusClass = "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20";
                        }

                        return (
                          <li
                            key={s.id}
                            className="flex flex-col gap-1 rounded-md px-3 py-3 bg-zinc-50 dark:bg-zinc-900"
                          >
                            <span className="text-sm font-medium text-black dark:text-white truncate">
                              {s.speaker}
                            </span>
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-2 text-xs font-semibold ${statusClass}`}
                            >
                              {statusLabel}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )
                ) : (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Sign in to see the speakers you&apos;ve suggested.
                  </p>
                )}
              </section>
            </aside>
          </section>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden flex-1 flex flex-col lg:py-8 py-6 px-6">
          {/* Mobile: Your suggestions above the leaderboard */}
          <section className="mb-4">
            <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 shadow-sm">
              <h2 className="text-lg font-bold text-black dark:text-white mb-2 font-serif">
                Your suggested speakers
              </h2>
              {user ? (
                userSuggestions.length === 0 ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    You haven&apos;t suggested anyone yet.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {userSuggestions.map(s => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 dark:border-zinc-800 px-3 py-2 bg-zinc-50 dark:bg-zinc-900"
                      >
                        <span className="text-sm font-medium text-black dark:text-white truncate">
                          {s.speaker}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Sign in to see the speakers you&apos;ve suggested.
                </p>
              )}
            </div>
          </section>

          <section className="flex-1 flex flex-col">
            <Leaderboard
              suggestions={leaderboardData}
              isLoggedIn={!!user}
              userSuggestions={userSuggestions}
            />
          </section>
        </div>

          {/* Mobile: Fixed bottom suggest bar */}
        <section className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-black p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <SuggestForm />
              </div>
            </div>
          ) : (
            <Link
              href="/api/auth/google?redirect_to=/suggest"
              prefetch={false}
              className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg font-semibold text-white
                         bg-[#A80D0C] hover:bg-[#8a0b0a] transition-all"
            >
              Sign in to suggest a speaker
            </Link>
          )}
        </section>
      </main>
    </div>
  );
}
