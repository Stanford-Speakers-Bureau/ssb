"use client";

import { useEffect, useState } from "react";
import { HIGH_PERFORMER_CHECKIN_THRESHOLD } from "@/app/lib/constants";
import { useEventContext } from "@/app/EventContext";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Toggle,
} from "@/app/components/ui";

type ReferralEntry = {
  referral_code: string;
  count: number;
  checked_in_count: number;
};

function getRankColor(rank: number): string {
  if (rank === 0) return "bg-amber-400 text-amber-900";
  if (rank === 1) return "bg-zinc-300 text-zinc-700";
  if (rank === 2) return "bg-amber-600 text-amber-100";
  return "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300";
}

export default function ReferralLeaderboardClient() {
  const { selectedEventId } = useEventContext();
  const [leaderboard, setLeaderboard] = useState<ReferralEntry[]>([]);
  const [referralsEnabled, setReferralsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  useEffect(() => {
    if (!selectedEventId) {
      setLeaderboard([]);
      setReferralsEnabled(false);
      return;
    }

    const eventId = selectedEventId;
    const controller = new AbortController();
    const { signal } = controller;

    async function fetchLeaderboard() {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.append("eventId", eventId);

        const response = await fetch(`/api/referrals?${params}`, { signal });

        if (!response.ok) {
          let errorMessage = "Failed to fetch leaderboard";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Invalid response format from server");
        }

        const data = await response.json();
        if (signal.aborted) return;
        setLeaderboard(data.leaderboard || []);
        setReferralsEnabled(data.event?.referrals_enabled ?? false);
      } catch (err) {
        if (
          signal.aborted ||
          (err as { name?: string } | null)?.name === "AbortError"
        ) {
          return;
        }
        console.error("Error fetching leaderboard:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load leaderboard",
        );
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    }

    fetchLeaderboard();

    return () => controller.abort();
  }, [selectedEventId, refreshKey]);

  async function handleToggleReferrals() {
    if (!selectedEventId || isToggling) return;
    setIsToggling(true);
    try {
      const newValue = !referralsEnabled;
      const res = await fetch("/api/referrals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          referrals_enabled: newValue,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to toggle referrals");
      }
      setReferralsEnabled(newValue);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to toggle referrals",
      );
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 py-8">
      <PageHeader
        className="mb-8"
        title="Referral Leaderboard"
        subtitle="Top referrers for this event"
      >
        {selectedEventId && (
          <Toggle
            checked={referralsEnabled}
            disabled={isToggling || isLoading}
            onChange={handleToggleReferrals}
            label={referralsEnabled ? "Referrals On" : "Referrals Off"}
          />
        )}
        <Button onClick={handleRefresh} disabled={isLoading}>
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <Alert tone="error" className="mb-6">
          {error}
        </Alert>
      )}

      {!selectedEventId ? (
        <EmptyState
          title="No event selected"
          hint="Select an event from the sidebar to view referrals"
        />
      ) : isLoading ? (
        <EmptyState title="Loading leaderboard…" />
      ) : leaderboard.length === 0 ? (
        <EmptyState
          title="No referrals yet"
          hint="No referrals for this event"
        />
      ) : (
        <Card>
          <div className="space-y-2">
            {leaderboard.map((referral, index) => {
              const isHighPerformer =
                referral.checked_in_count >= HIGH_PERFORMER_CHECKIN_THRESHOLD;
              return (
                <div
                  key={referral.referral_code}
                  className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                    isHighPerformer
                      ? "bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/25 hover:bg-emerald-500/20"
                      : "bg-white/5 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${getRankColor(
                      index,
                    )}`}
                  >
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`font-medium ${isHighPerformer ? "text-emerald-300" : "text-white"}`}
                    >
                      {referral.referral_code}
                    </p>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="text-amber-400 font-bold text-lg">
                        {referral.checked_in_count}
                      </p>
                      <p className="text-zinc-500 text-xs">checked in</p>
                    </div>
                    <div>
                      <p className="text-emerald-400 font-bold text-lg">
                        {referral.count}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        {referral.count === 1 ? "referral" : "referrals"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
