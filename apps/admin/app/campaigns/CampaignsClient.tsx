"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AUDIENCE_TYPE_LABELS } from "@/app/lib/campaignAudienceConfig";
import {
  Button,
  EmptyState,
  StatusPill,
  Alert,
  PageHeader,
  Table,
  TableScroll,
  THead,
  TBody,
  TR,
  TH,
  TD,
} from "@/app/components/ui";
import { PlusIcon } from "@heroicons/react/16/solid";
import type { SemanticColor } from "@/app/components/ui";

type Campaign = {
  id: string;
  subject: string;
  status: string;
  audiences: string;
  eventId: string | null;
  eventName: string | null;
  includeHeroCard: boolean;
  sentAt: string | null;
  sentBy: string | null;
  recipientCount: number | null;
  failedCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

function StatusBadge({ status }: { status: string }) {
  const color: SemanticColor =
    status === "sent"
      ? "emerald"
      : status === "partial"
        ? "amber"
        : status === "sending"
          ? "amber"
          : "zinc";

  return (
    <StatusPill color={color}>
      {status === "sending" && (
        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </StatusPill>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

export default function CampaignsClient() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/campaigns")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setCampaigns(data.campaigns ?? []);
        }
      })
      .catch(() => setError("Failed to load campaigns"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <PageHeader
        title="Email campaigns"
        subtitle={
          <>
            Create and send mass emails to your audience
            {campaigns.length > 0 && (
              <span className="text-zinc-600"> · {campaigns.length} total</span>
            )}
          </>
        }
        className="mb-8"
      >
        <Button variant="primary" onClick={() => router.push("/campaigns/new")}>
          <span className="flex items-center gap-2">
            <PlusIcon className="size-4 shrink-0" />
            New campaign
          </span>
        </Button>
      </PageHeader>

      {/* Error */}
      {error && (
        <div className="mb-6">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-16">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-rose-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500 text-sm">Loading campaigns...</p>
        </div>
      ) : campaigns.length === 0 ? (
        /* Empty state */
        <EmptyState
          title="No campaigns yet"
          hint="Create your first email campaign to get started."
        >
          <Button
            variant="primary"
            onClick={() => router.push("/campaigns/new")}
          >
            Create campaign
          </Button>
        </EmptyState>
      ) : (
        /* Campaign table */
        <TableScroll>
          <Table>
            <THead>
              <TR className="border-b border-white/10">
                <TH>Subject</TH>
                <TH>Status</TH>
                <TH>Audience</TH>
                <TH>Recipients</TH>
                <TH>Date</TH>
              </TR>
            </THead>
            <TBody>
              {campaigns.map((c) => (
                <TR
                  key={c.id}
                  onClick={() => router.push(`/campaigns/${c.id}`)}
                  className="hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <TD>
                    <div className="text-sm text-white font-medium truncate max-w-xs">
                      {c.subject || "Untitled"}
                    </div>
                    {c.eventName && (
                      <div className="text-xs text-zinc-500 mt-0.5 truncate max-w-xs">
                        {c.eventName}
                      </div>
                    )}
                  </TD>
                  <TD>
                    <StatusBadge status={c.status} />
                  </TD>
                  <TD className="text-zinc-400">
                    {(() => {
                      try {
                        const entries = JSON.parse(c.audiences || "[]") as {
                          type: string;
                        }[];
                        return (
                          entries
                            .map(
                              (e) =>
                                AUDIENCE_TYPE_LABELS[
                                  e.type as keyof typeof AUDIENCE_TYPE_LABELS
                                ] || e.type,
                            )
                            .join(", ") || "\u2014"
                        );
                      } catch {
                        return "\u2014";
                      }
                    })()}
                  </TD>
                  <TD className="text-zinc-400">
                    {(c.status === "sent" || c.status === "partial") &&
                    c.recipientCount != null
                      ? `${c.recipientCount.toLocaleString()}${c.failedCount > 0 ? ` sent, ${c.failedCount.toLocaleString()} failed` : ""}`
                      : "\u2014"}
                  </TD>
                  <TD className="text-zinc-500 whitespace-nowrap">
                    {formatDate(c.sentAt || c.createdAt)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}
