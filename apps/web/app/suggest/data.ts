import { db, and, eq, suggest, votes } from "@ssb/db";

export type Suggestion = {
  id: string;
  speaker: string;
  votes: number;
  hasVoted: boolean;
};

export type UserSuggestion = {
  id: string;
  speaker: string;
  approved: boolean;
  reviewed: boolean;
  duplicate?: boolean;
  spoke?: boolean;
};

export async function getUserSuggestions(
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
      spoke: true,
    },
    orderBy: (suggest, { desc }) => [desc(suggest.createdAt)],
  });

  return data.map((s) => ({
    id: s.id,
    speaker: s.speaker || "",
    approved: !!s.approved,
    reviewed: !!s.reviewed,
    duplicate: !!s.duplicate,
    spoke: !!s.spoke,
  }));
}

export function getUserInitials(
  name: string | null,
  email: string | null,
): string {
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

export async function getLeaderboardData(
  userEmail: string | null,
): Promise<Suggestion[]> {
  const suggestions = await db.query.suggest.findMany({
    where: and(eq(suggest.approved, true), eq(suggest.spoke, false)),
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
