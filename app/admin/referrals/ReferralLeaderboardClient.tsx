"use client";

import { useEffect, useState } from "react";

type ReferralEntry = {
  referral_code: string;
  count: number;
};

type EventGroup = {
  event: {
    id: string;
    name: string | null;
    route: string | null;
  };
  referrals: ReferralEntry[];
};

type ReferralLeaderboardClientProps = {
  initialLeaderboard: EventGroup[] | ReferralEntry[];
  initialEvents: { id: string; name: string | null }[];
  isGrouped: boolean;
  initialEventId?: string | null;
};

function getRankColor(rank: number): string {
  if (rank === 0) return "bg-amber-400 text-amber-900";
  if (rank === 1) return "bg-zinc-300 text-zinc-700";
  if (rank === 2) return "bg-amber-600 text-amber-100";
  return "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300";
}

export default function ReferralLeaderboardClient({
  initialLeaderboard,
  initialEvents,
  isGrouped: initialIsGrouped,
  initialEventId,
}: ReferralLeaderboardClientProps) {
  const [leaderboard, setLeaderboard] = useState<
    EventGroup[] | ReferralEntry[]
  >(initialLeaderboard);
  const [selectedEventId, setSelectedEventId] = useState<string>(
    initialEventId || "",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGrouped, setIsGrouped] = useState(initialIsGrouped);

  useEffect(() => {
    async function fetchLeaderboard() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (selectedEventId) {
          params.append("eventId", selectedEventId);
        }

        const response = await fetch(
          `/api/admin/referrals/leaderboard?${params}`,
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch leaderboard");
        }

        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
        setIsGrouped(data.grouped || false);
      } catch (err) {
        console.error("Error fetching leaderboard:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load leaderboard",
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaderboard();
  }, [selectedEventId]);

  if (isGrouped && Array.isArray(leaderboard) && leaderboard.length > 0) {
    const eventGroups = leaderboard as EventGroup[];
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white font-serif mb-2">
            Referral Leaderboard
          </h1>
          <p className="text-zinc-400">Top referrers across all events</p>
        </div>

        {/* Event Filter */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Filter by Event
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full max-w-md px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
          >
            <option value="">All Events</option>
            {initialEvents.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name || "Unnamed Event"}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
            <p className="text-rose-400 text-sm">{error}</p>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
            <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
            </div>
            <p className="text-zinc-400">Loading leaderboard...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {eventGroups.map((group) => (
              <div
                key={group.event.id}
                className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6"
              >
                <h2 className="text-xl font-bold text-white mb-4">
                  {group.event.name || "Unnamed Event"}
                </h2>
                {group.referrals.length === 0 ? (
                  <p className="text-zinc-400 text-sm">No referrals yet</p>
                ) : (
                  <div className="space-y-2">
                    {group.referrals.map((referral, index) => (
                      <div
                        key={referral.referral_code}
                        className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${getRankColor(
                            index,
                          )}`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium">
                            {referral.referral_code}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-emerald-400 font-bold text-lg">
                            {referral.count}
                          </p>
                          <p className="text-zinc-500 text-xs">
                            {referral.count === 1 ? "referral" : "referrals"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Single event view
  const entries = leaderboard as ReferralEntry[];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white font-serif mb-2">
          Referral Leaderboard
        </h1>
        <p className="text-zinc-400">Top referrers for this event</p>
      </div>

      {/* Event Filter */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Filter by Event
        </label>
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-full max-w-md px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
        >
          <option value="">All Events</option>
          {initialEvents.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name || "Unnamed Event"}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl">
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          </div>
          <p className="text-zinc-400">Loading leaderboard...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p className="text-zinc-400 text-lg mb-2">No referrals yet</p>
          <p className="text-zinc-600 text-sm">
            {selectedEventId
              ? "No referrals for this event"
              : "No referrals across any events"}
          </p>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6">
          <div className="space-y-2">
            {entries.map((referral, index) => (
              <div
                key={referral.referral_code}
                className="flex items-center gap-4 p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${getRankColor(
                    index,
                  )}`}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">
                    {referral.referral_code}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-bold text-lg">
                    {referral.count}
                  </p>
                  <p className="text-zinc-500 text-xs">
                    {referral.count === 1 ? "referral" : "referrals"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
