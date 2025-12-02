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

export default async function SuggestPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user metadata from Google OAuth
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  // Fetch leaderboard data
  const leaderboardData = await getLeaderboardData(user?.email || null);

  return (
    <div className="flex h-[calc(100vh-2.5rem)] flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 bg-white dark:bg-black pt-16">
        {/* Desktop Layout - Leaderboard centered with Suggest to its right */}
        <div className="hidden lg:flex flex-1 justify-center items-start py-8 px-6 relative">
          <section className="w-full max-w-xl h-full flex flex-col">
            <Leaderboard suggestions={leaderboardData} isLoggedIn={!!user} />
          </section>

          {/* Suggest Section - Positioned to the right of centered leaderboard */}
          <section className="absolute top-8 left-[calc(50%+320px)] w-96 overflow-y-auto max-h-[calc(100vh-10rem)] bg-white dark:bg-black p-4 rounded-lg ">
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
                  <p className="text-black dark:text-white font-medium truncate max-w-[200px]">{userName || user.email}</p>
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
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden flex-1 flex flex-col lg:py-8 py-6 px-6">
          <section className="flex-1 flex flex-col">
            <Leaderboard suggestions={leaderboardData} isLoggedIn={!!user} />
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
