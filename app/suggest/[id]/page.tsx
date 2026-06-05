import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db, eq, and, suggest } from "@ssb/db";
import { getSessionUser } from "@/app/lib/auth";
import { isValidUUID } from "@/app/lib/validation";
import { SPEAKERS } from "@/app/config/speakers";
import Leaderboard from "../Leaderboard";
import SubmitPanel from "../SubmitPanel";
import UserSuggestionsPanel from "../UserSuggestionsPanel";
import { getLeaderboardData, getUserSuggestions } from "../data";
import HighlightedName from "./HighlightedName";

type PageParams = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vote?: string; share?: string }>;
};

async function loadSuggestion(id: string) {
  if (!isValidUUID(id)) return null;
  const row = await db.query.suggest.findFirst({
    where: and(eq(suggest.id, id), eq(suggest.approved, true)),
    columns: { id: true, speaker: true, spoke: true, eventLink: true },
  });
  if (!row?.speaker) return null;
  return {
    id: row.id,
    speaker: row.speaker,
    spoke: row.spoke,
    eventLink: row.eventLink,
  };
}

// Normalize a name for slug matching: lowercase, strip accents/punctuation,
// collapse whitespace. "Stephen O'Brien" and "stephen obrien" compare equal.
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Match a spoken suggestion to its archive entry by name, so the unique link
// can deeplink to that speaker's profile on /past-speakers.
function findArchiveSlug(speaker: string): string | null {
  const target = normalizeName(speaker);
  if (!target) return null;
  return SPEAKERS.find((s) => normalizeName(s.name) === target)?.slug ?? null;
}

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { id } = await params;
  const s = await loadSuggestion(id);
  // Spoke suggestions redirect away, so don't advertise an indexable page.
  if (!s || s.spoke) {
    return {
      title: "Suggestion not found",
      robots: { index: false, follow: false },
    };
  }
  const title = `Should ${s.speaker} come speak at Stanford?`;
  const description = `Help bring ${s.speaker} to Stanford. Vote on the Stanford Speakers Bureau community board.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Stanford Speakers Bureau",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SuggestionDeepLinkPage({
  params,
  searchParams,
}: PageParams) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const suggestion = await loadSuggestion(id);
  if (!suggestion) notFound();

  // Once a speaker has spoken, the unique link redirects: to the admin-set
  // event link if any, else to the speaker's archive entry (matched by name),
  // else to the bare past-speakers page.
  if (suggestion.spoke) {
    if (suggestion.eventLink) redirect(suggestion.eventLink);
    const slug = findArchiveSlug(suggestion.speaker);
    redirect(slug ? `/past-speakers?speaker=${encodeURIComponent(slug)}` : "/past-speakers");
  }

  const user = await getSessionUser();
  const wantsAutoVote = sp.vote === "1";
  const wantsAutoShare = sp.share === "1";
  const signInRedirect = `/suggest/${suggestion.id}`;

  const [leaderboardData, userSuggestions] = await Promise.all([
    getLeaderboardData(user?.email || null),
    getUserSuggestions(user?.email || null),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--ssb-paper)] font-sans text-[var(--ssb-ink)]">
      <main className="flex w-full flex-col">
        {/* Hero */}
        <section className="relative bg-[var(--ssb-paper)] pt-32 pb-12 sm:pt-40 sm:pb-16 px-6 sm:px-12">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs sm:text-sm font-sans uppercase tracking-[0.3em] text-[#A80D0C] mb-4">
              Stanford Speakers Bureau
            </p>
            <h1 className="font-serif text-4xl sm:text-6xl text-white leading-[1.05]">
              Should <HighlightedName name={suggestion.speaker} /> come speak at
              Stanford?
            </h1>
            <p className="mt-5 font-sans text-base sm:text-lg text-zinc-400 leading-relaxed">
              Upvote <strong>{suggestion.speaker}</strong> below, and while
              you&rsquo;re here, add other names you&rsquo;d love to see and
              help us pick the rest of the lineup.
            </p>
          </div>
        </section>

        {/* Leaderboard + Submit */}
        <section className="relative bg-zinc-950 border-t border-zinc-900 py-16 sm:py-20 px-6 sm:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-10 sm:mb-12">
              <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
                The Leaderboard
              </p>
              <h2 className="font-serif text-2xl sm:text-4xl text-white leading-[0.95]">
                Vote on every speaker the community wants next
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-10 lg:gap-12">
              <div>
                <Leaderboard
                  suggestions={leaderboardData}
                  isLoggedIn={!!user}
                  pinnedId={suggestion.id}
                  autoVoteId={wantsAutoVote ? suggestion.id : null}
                  autoShareId={wantsAutoShare ? suggestion.id : null}
                />
              </div>

              <aside>
                <div className="lg:sticky lg:top-28">
                  <div className="flex items-center gap-4 mb-5">
                    <p className="text-xs uppercase tracking-[0.3em] text-[#A80D0C]">
                      Got someone else in mind?
                    </p>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>
                  <p className="font-sans text-xs text-zinc-500 mb-4 leading-relaxed">
                    Add another name to the list. Every suggestion goes to the
                    leaderboard once we review it.
                  </p>
                  <SubmitPanel
                    user={user}
                    signInRedirect={signInRedirect}
                    eyebrow="Suggest"
                    heading="Add another name"
                  />
                </div>
              </aside>
            </div>
          </div>
        </section>

        {/* Your suggestions */}
        {user && (
          <section className="relative bg-[var(--ssb-paper)] border-t border-zinc-900 py-16 sm:py-20 px-6 sm:px-12">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-4 mb-5">
                <p className="text-xs uppercase tracking-[0.3em] text-[#A80D0C]">
                  Your suggestions
                </p>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>
              <p className="font-sans text-xs text-zinc-500 mb-4 leading-relaxed">
                New suggestions take a little time to be reviewed before they
                appear on the leaderboard.
              </p>
              <UserSuggestionsPanel
                userSuggestions={userSuggestions}
                isLoggedIn={!!user}
              />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
