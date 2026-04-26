import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db, eq, and, suggest, votes } from "@ssb/db";
import { getSessionUser } from "@/app/lib/auth";
import { isValidUUID } from "@/app/lib/validation";
import SuggestionCard from "./SuggestionCard";

type PageParams = { params: Promise<{ id: string }>; searchParams: Promise<{ vote?: string }> };

async function loadSuggestion(id: string) {
  if (!isValidUUID(id)) return null;
  const row = await db.query.suggest.findFirst({
    where: and(eq(suggest.id, id), eq(suggest.approved, true)),
    columns: { id: true, speaker: true },
  });
  if (!row?.speaker) return null;
  return { id: row.id, speaker: row.speaker };
}

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { id } = await params;
  const s = await loadSuggestion(id);
  if (!s) {
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

export default async function SuggestionDeepLinkPage({ params, searchParams }: PageParams) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const suggestion = await loadSuggestion(id);
  if (!suggestion) notFound();

  const user = await getSessionUser();
  const wantsAutoVote = sp.vote === "1";

  let hasVoted = false;
  if (user?.email) {
    const existing = await db.query.votes.findFirst({
      where: and(eq(votes.speakerId, suggestion.id), eq(votes.email, user.email)),
      columns: { id: true },
    });
    hasVoted = !!existing;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--ssb-paper)] font-sans text-[var(--ssb-ink)]">
      <main className="flex w-full flex-1 items-center justify-center px-6 py-24 sm:px-12">
        <div className="w-full max-w-xl">
          <p className="text-xs font-sans uppercase tracking-[0.3em] text-[#A80D0C] mb-4 text-center">
            Stanford Speakers Bureau
          </p>
          <h1 className="text-center font-serif text-4xl sm:text-5xl text-white leading-[1.05]">
            Should{" "}
            <span className="text-[#A80D0C] drop-shadow-[0_0_40px_rgba(168,13,12,0.3)]">
              {suggestion.speaker}
            </span>{" "}
            come speak at Stanford?
          </h1>
          <p className="mt-5 text-center font-sans text-base text-zinc-400 leading-relaxed">
            We chase the names with the most community support. Add your vote
            below — it takes a few seconds.
          </p>

          <SuggestionCard
            id={suggestion.id}
            speaker={suggestion.speaker}
            isLoggedIn={!!user}
            initialHasVoted={hasVoted}
            autoVote={wantsAutoVote}
          />

          <div className="mt-10 text-center">
            <Link
              href="/suggest"
              prefetch={false}
              className="text-xs font-sans uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:text-zinc-300"
            >
              See the full leaderboard →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
