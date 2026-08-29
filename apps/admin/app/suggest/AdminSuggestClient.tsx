"use client";

import { useState } from "react";
import {
  ArrowPathIcon,
  ArrowsRightLeftIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  LinkIcon,
  PencilIcon,
  UserIcon,
  HandThumbUpIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import {
  Button,
  EmptyState,
  Input,
  Label,
  PageHeader,
  StatusPill,
  Tabs,
  Tab,
} from "@/app/components/ui";

export type Suggestion = {
  id: string;
  created_at: string;
  email: string;
  speaker: string;
  votes: number;
  approved: boolean;
  reviewed: boolean;
  duplicate?: boolean;
  spoke?: boolean;
  // Where the unique link redirects once the speaker has spoken (null = past speakers)
  eventLink?: string | null;
  // List of voter emails for this suggestion (admin-only view)
  voters?: string[];
};

type AdminSuggestClientProps = {
  initialSuggestions: Suggestion[];
};

export default function AdminSuggestClient({
  initialSuggestions,
}: AdminSuggestClientProps) {
  const [suggestions, setSuggestions] =
    useState<Suggestion[]>(initialSuggestions);
  const [filter, setFilter] = useState<
    "pending" | "approved" | "rejected" | "spoke" | "all"
  >("pending");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(
    null,
  );
  const [editedSpeaker, setEditedSpeaker] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [duplicateSuggestion, setDuplicateSuggestion] =
    useState<Suggestion | null>(null);
  const [isMergingDuplicate, setIsMergingDuplicate] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isSyncingVotes, setIsSyncingVotes] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [editingVotes, setEditingVotes] = useState<Suggestion | null>(null);
  const [voteCount, setVoteCount] = useState<number>(0);
  const [isSavingVoteCount, setIsSavingVoteCount] = useState(false);
  const [voteEditError, setVoteEditError] = useState<string | null>(null);
  const [spokeSuggestion, setSpokeSuggestion] = useState<Suggestion | null>(
    null,
  );
  const [eventLinkInput, setEventLinkInput] = useState("");
  const [isSavingSpoke, setIsSavingSpoke] = useState(false);
  const [spokeError, setSpokeError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com";
  const shareLinkFor = (id: string) => `${baseUrl}/suggest/${id}`;

  async function copyShareLink(id: string) {
    try {
      await navigator.clipboard.writeText(shareLinkFor(id));
      setCopiedId(id);
      window.setTimeout(
        () => setCopiedId((prev) => (prev === id ? null : prev)),
        1500,
      );
    } catch (error) {
      console.error("Failed to copy share link:", error);
    }
  }

  async function handleAction(
    id: string,
    action: "approve" | "reject" | "unapprove",
  ) {
    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Failed to process suggestion:",
          data.error || "Unknown error",
        );
        return;
      }

      if (Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error("Failed to process suggestion:", error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function handleBulkAction(action: "approve" | "reject") {
    const pendingIds = filteredSuggestions
      .filter((s) => !s.reviewed)
      .map((s) => s.id);

    for (const id of pendingIds) {
      await handleAction(id, action);
    }
  }

  function startEditing(suggestion: Suggestion) {
    setEditingSuggestion(suggestion);
    setEditedSpeaker(suggestion.speaker);
    setEditError(null);
  }

  function closeEditing() {
    setEditingSuggestion(null);
    setEditedSpeaker("");
    setIsSavingEdit(false);
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editingSuggestion) return;
    const trimmed = editedSpeaker.trim();
    if (!trimmed) {
      setEditError("Speaker name cannot be empty.");
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const response = await fetch("/api/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingSuggestion.id, speaker: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        setEditError(data.error || "Failed to update speaker name.");
        setIsSavingEdit(false);
        return;
      }

      if (Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
      closeEditing();
    } catch (error) {
      console.error("Failed to edit suggestion:", error);
      setEditError("Failed to update speaker. Please try again.");
      setIsSavingEdit(false);
    }
  }

  function startDuplicateMerge(suggestion: Suggestion) {
    setDuplicateSuggestion(suggestion);
    setMergeError(null);
  }

  function closeDuplicateMerge() {
    setDuplicateSuggestion(null);
    setIsMergingDuplicate(false);
    setMergeError(null);
  }

  async function handleMergeDuplicate(targetId: string) {
    if (!duplicateSuggestion) return;

    setIsMergingDuplicate(true);
    setMergeError(null);

    try {
      const response = await fetch("/api/suggestions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: duplicateSuggestion.id,
          targetId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMergeError(data.error || "Failed to merge duplicate.");
        setIsMergingDuplicate(false);
        return;
      }

      if (Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
      closeDuplicateMerge();
    } catch (error) {
      console.error("Failed to merge duplicate:", error);
      setMergeError("Failed to merge duplicate. Please try again.");
      setIsMergingDuplicate(false);
    }
  }

  async function handleToggleSpoke(
    id: string,
    spoke: boolean,
    eventLink?: string,
  ): Promise<boolean> {
    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      const response = await fetch("/api/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, spoke, eventLink }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(
          "Failed to update spoke status:",
          data.error || "Unknown error",
        );
        setSpokeError(data.error || "Failed to update. Please try again.");
        return false;
      }

      if (Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
      return true;
    } catch (error) {
      console.error("Failed to toggle spoke:", error);
      setSpokeError("Failed to update. Please try again.");
      return false;
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function startMarkSpoke(suggestion: Suggestion) {
    setSpokeSuggestion(suggestion);
    setEventLinkInput(suggestion.eventLink ?? "");
    setSpokeError(null);
  }

  function closeMarkSpoke() {
    setSpokeSuggestion(null);
    setEventLinkInput("");
    setIsSavingSpoke(false);
    setSpokeError(null);
  }

  async function handleConfirmSpoke() {
    if (!spokeSuggestion) return;

    const trimmed = eventLinkInput.trim();
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      setSpokeError("Event link must start with http:// or https://");
      return;
    }

    setIsSavingSpoke(true);
    setSpokeError(null);

    const ok = await handleToggleSpoke(spokeSuggestion.id, true, trimmed);
    if (ok) {
      closeMarkSpoke();
    } else {
      setIsSavingSpoke(false);
    }
  }

  async function handleSyncVotes() {
    setIsSyncingVotes(true);
    setSyncError(null);

    try {
      const response = await fetch("/api/suggestions/sync-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        setSyncError(data.error || "Failed to sync votes.");
        setIsSyncingVotes(false);
        return;
      }

      if (Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
        // Update editingVotes if modal is open
        if (editingVotes) {
          const updated = data.suggestions.find(
            (s: Suggestion) => s.id === editingVotes.id,
          );
          if (updated) {
            setEditingVotes(updated);
          }
        }
      }
      setIsSyncingVotes(false);
    } catch (error) {
      console.error("Failed to sync votes:", error);
      setSyncError("Failed to sync votes. Please try again.");
      setIsSyncingVotes(false);
    }
  }

  function startEditingVotes(suggestion: Suggestion) {
    setEditingVotes(suggestion);
    setVoteCount(suggestion.votes);
    setVoteEditError(null);
  }

  function closeEditingVotes() {
    setEditingVotes(null);
    setVoteCount(0);
    setIsSavingVoteCount(false);
    setVoteEditError(null);
  }

  async function handleSaveVoteCount() {
    if (!editingVotes) return;

    if (voteCount < 0 || !Number.isInteger(voteCount)) {
      setVoteEditError("Vote count must be a non-negative integer.");
      return;
    }

    setIsSavingVoteCount(true);
    setVoteEditError(null);

    try {
      const response = await fetch("/api/suggestions/votes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speaker_id: editingVotes.id,
          votes: voteCount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setVoteEditError(data.error || "Failed to update vote count.");
        setIsSavingVoteCount(false);
        return;
      }

      if (Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions);
      }
      closeEditingVotes();
    } catch (error) {
      console.error("Failed to update vote count:", error);
      setVoteEditError("Failed to update vote count. Please try again.");
      setIsSavingVoteCount(false);
    }
  }

  const pendingCount = suggestions.filter((s) => !s.reviewed).length;

  // Pre-compute approved suggestions with tokenized speaker names for fuzzy matching
  const approvedSuggestions = suggestions
    .filter((s) => s.approved)
    .map((s) => ({
      ...s,
      _tokens: s.speaker.toLowerCase().split(/\s+/).filter(Boolean),
    }));

  const filterTabs = [
    { id: "pending" as const, label: "Pending", count: pendingCount },
    { id: "approved" as const, label: "Approved" },
    { id: "rejected" as const, label: "Rejected" },
    { id: "spoke" as const, label: "Spoke" },
    { id: "all" as const, label: "All" },
  ];

  const filteredSuggestions = suggestions
    .filter((s) => {
      switch (filter) {
        case "pending":
          return !s.reviewed;
        case "approved":
          return s.reviewed && s.approved && !s.spoke;
        case "rejected":
          return s.reviewed && !s.approved;
        case "spoke":
          return s.spoke;
        case "all":
        default:
          return true;
      }
    })
    // For approved tab, sort by most votes first; keep existing order for other tabs
    .sort((a, b) => {
      if (filter !== "approved") return 0;
      return b.votes - a.votes;
    });

  return (
    <div className="px-4 sm:px-6 py-8">
      <PageHeader
        className="mb-8 flex-col sm:flex-row sm:items-start"
        title="Speaker Suggestions"
        subtitle="Review and manage speaker suggestions from users."
      >
        <Button
          variant="secondary"
          onClick={handleSyncVotes}
          disabled={isSyncingVotes}
          className="flex items-center gap-2"
        >
          {isSyncingVotes ? (
            <div className="size-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ArrowPathIcon className="size-4 shrink-0" aria-hidden="true" />
          )}
          {isSyncingVotes ? "Syncing…" : "Resync votes"}
        </Button>
      </PageHeader>
      {syncError && (
        <p className="mb-8 -mt-6 text-sm text-rose-400">{syncError}</p>
      )}

      {/* Filter Tabs */}
      <Tabs wrap className="mb-6">
        {filterTabs.map((tab) => (
          <Tab
            key={tab.id}
            active={filter === tab.id}
            count={
              tab.id === "pending" && pendingCount > 0
                ? pendingCount
                : undefined
            }
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
          </Tab>
        ))}
      </Tabs>

      {/* Bulk Actions */}
      {filter === "pending" && pendingCount > 0 && (
        <div className="flex gap-3 mb-6 p-4 bg-white/5 rounded-2xl ring-1 ring-inset ring-white/10">
          <button
            type="button"
            onClick={() => handleBulkAction("approve")}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors"
          >
            <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
            Approve All ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => handleBulkAction("reject")}
            className="flex items-center gap-2 px-3 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-500/30 transition-colors"
          >
            <XMarkIcon className="size-4 shrink-0" aria-hidden="true" />
            Reject All
          </button>
        </div>
      )}

      {/* Suggestions List */}
      {filteredSuggestions.length === 0 ? (
        <EmptyState
          title="No suggestions found"
          hint={
            filter === "pending"
              ? "All caught up! No pending suggestions."
              : `No ${filter} suggestions yet.`
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredSuggestions.map((suggestion) => {
            const pendingTokens = suggestion.speaker
              .toLowerCase()
              .split(/\s+/)
              .filter(Boolean);

            // Find all approved suggestions whose name shares at least one token.
            // Applies to pending, rejected, and approved items (excluding self so an
            // approved pick can be merged into another approved duplicate).
            const matchingApproved = approvedSuggestions.filter(
              (approved) =>
                approved.id !== suggestion.id &&
                approved._tokens.some((t) => pendingTokens.includes(t)),
            );

            const isDuplicateOfApproved = matchingApproved.length > 0;

            return (
              <div
                key={suggestion.id}
                className={`bg-zinc-900/60 rounded-2xl border p-6 transition-all ${
                  suggestion.reviewed
                    ? suggestion.approved
                      ? "border-emerald-500/30"
                      : "border-rose-500/30"
                    : "border-white/10 hover:border-white/20"
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {suggestion.speaker}
                      </h3>
                      {suggestion.reviewed && (
                        <StatusPill
                          color={
                            suggestion.approved
                              ? "emerald"
                              : suggestion.duplicate
                                ? "amber"
                                : "rose"
                          }
                        >
                          {suggestion.approved
                            ? "Approved"
                            : suggestion.duplicate
                              ? "Duplicate"
                              : "Rejected"}
                        </StatusPill>
                      )}
                      {suggestion.spoke && (
                        <StatusPill color="sky">Spoke</StatusPill>
                      )}
                      {!suggestion.reviewed && isDuplicateOfApproved && (
                        <StatusPill color="amber">Duplicate</StatusPill>
                      )}
                      {suggestion.reviewed &&
                        !suggestion.approved &&
                        isDuplicateOfApproved &&
                        !suggestion.duplicate && (
                          <StatusPill color="amber">Duplicate</StatusPill>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <UserIcon className="size-4 shrink-0" aria-hidden="true" />
                        {suggestion.email}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <HandThumbUpIcon className="size-4 shrink-0" aria-hidden="true" />
                        {suggestion.votes} votes
                      </span>
                      <span className="flex items-center gap-1.5">
                        <ClockIcon className="size-4 shrink-0" aria-hidden="true" />
                        {new Date(suggestion.created_at).toLocaleDateString(
                          "en-US",
                          { timeZone: "America/Los_Angeles" },
                        )}
                      </span>
                    </div>
                    {/* Public share link — available for every suggestion */}
                    <div className="mt-2 flex items-center gap-2 text-sm text-zinc-400">
                      <LinkIcon className="size-4 shrink-0" aria-hidden="true" />
                      <a
                        href={shareLinkFor(suggestion.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={shareLinkFor(suggestion.id)}
                        className="truncate text-zinc-300 hover:text-sky-300 hover:underline"
                      >
                        {shareLinkFor(suggestion.id).replace(/^https?:\/\//, "")}
                      </a>
                      <button
                        type="button"
                        onClick={() => copyShareLink(suggestion.id)}
                        className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        {copiedId === suggestion.id ? "Copied!" : "Copy"}
                      </button>
                    </div>
                    {suggestion.spoke && (
                      <div className="mt-2 flex items-center gap-1.5 text-sm text-zinc-400">
                        <LinkIcon className="size-4 shrink-0" aria-hidden="true" />
                        {suggestion.eventLink ? (
                          <a
                            href={suggestion.eventLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-sky-300 hover:underline"
                          >
                            {suggestion.eventLink}
                          </a>
                        ) : (
                          <span>Link redirects to their archive entry</span>
                        )}
                      </div>
                    )}
                    {/* Matching approved suggestions (for pending and rejected items) */}
                    {matchingApproved.length > 0 && (
                      <div className="mt-2 text-xs text-zinc-400">
                        <p className="mb-1">
                          Matching approved suggestion
                          {matchingApproved.length > 1 ? "s" : ""}:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {matchingApproved.map((approved) => (
                            <span
                              key={approved.id}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 text-zinc-100 ring-1 ring-inset ring-white/10"
                            >
                              <span className="font-medium truncate max-w-[160px]">
                                {approved.speaker}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                ({approved.votes} votes)
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Voters */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                          <HandThumbUpIcon className="size-4 shrink-0" aria-hidden="true" />
                          <span>
                            {suggestion.voters?.length ?? 0} voter
                            {(suggestion.voters?.length ?? 0) === 1 ? "" : "s"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditingVotes(suggestion)}
                          className="text-xs px-2.5 py-1.5 text-zinc-400 rounded-md hover:bg-white/5 hover:text-white transition-colors"
                        >
                          Edit votes
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(suggestion.voters ?? []).length === 0 ? (
                          <p className="text-sm text-zinc-500">
                            No recorded voters for this suggestion yet.
                          </p>
                        ) : (
                          suggestion.voters!.map((email) => (
                            <span
                              key={email}
                              className="text-sm px-3 py-1 rounded-full bg-white/5 text-zinc-100 ring-1 ring-inset ring-white/10"
                            >
                              {email}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {!suggestion.reviewed && (
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {isDuplicateOfApproved && (
                        <button
                          type="button"
                          onClick={() => startDuplicateMerge(suggestion)}
                          disabled={processingIds.has(suggestion.id)}
                          className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                        >
                          <ArrowsRightLeftIcon className="size-4 shrink-0" aria-hidden="true" />
                          Duplicate
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleAction(suggestion.id, "approve")}
                        disabled={processingIds.has(suggestion.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {processingIds.has(suggestion.id) ? (
                          <div className="size-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                        )}
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(suggestion.id, "reject")}
                        disabled={processingIds.has(suggestion.id)}
                        className="flex items-center gap-2 px-3 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-500/30 transition-colors disabled:opacity-50"
                      >
                        {processingIds.has(suggestion.id) ? (
                          <div className="size-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <XMarkIcon className="size-4 shrink-0" aria-hidden="true" />
                        )}
                        Reject
                      </button>
                      <Button
                        variant="secondary"
                        onClick={() => startEditing(suggestion)}
                        className="flex items-center gap-2"
                      >
                        <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                        Edit
                      </Button>
                    </div>
                  )}
                  {suggestion.reviewed && (
                    <div className="flex gap-2 shrink-0 flex-wrap">
                      {suggestion.approved && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              suggestion.spoke
                                ? handleToggleSpoke(suggestion.id, false)
                                : startMarkSpoke(suggestion)
                            }
                            disabled={processingIds.has(suggestion.id)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                              suggestion.spoke
                                ? "bg-white/5 text-zinc-200 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                                : "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
                            }`}
                          >
                            {processingIds.has(suggestion.id) ? (
                              <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : suggestion.spoke ? (
                              <EyeIcon className="size-4 shrink-0" aria-hidden="true" />
                            ) : (
                              <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                            )}
                            {suggestion.spoke ? "Unhide" : "Mark Spoke"}
                          </button>
                          {suggestion.spoke && (
                            <button
                              type="button"
                              onClick={() => startMarkSpoke(suggestion)}
                              disabled={processingIds.has(suggestion.id)}
                              className="flex items-center gap-2 px-3 py-2 bg-white/5 text-zinc-200 ring-1 ring-inset ring-white/10 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                            >
                              <LinkIcon className="size-4 shrink-0" aria-hidden="true" />
                              Edit link
                            </button>
                          )}
                          {isDuplicateOfApproved && (
                            <button
                              type="button"
                              onClick={() => startDuplicateMerge(suggestion)}
                              disabled={processingIds.has(suggestion.id)}
                              className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                            >
                              <ArrowsRightLeftIcon className="size-4 shrink-0" aria-hidden="true" />
                              Duplicate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              handleAction(suggestion.id, "unapprove")
                            }
                            disabled={processingIds.has(suggestion.id)}
                            className="flex items-center gap-2 px-3 py-2 bg-white/5 text-zinc-200 ring-1 ring-inset ring-white/10 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
                          >
                            {processingIds.has(suggestion.id) ? (
                              <div className="size-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <ArrowUturnLeftIcon className="size-4 shrink-0" aria-hidden="true" />
                            )}
                            Unapprove
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleAction(suggestion.id, "reject")
                            }
                            disabled={processingIds.has(suggestion.id)}
                            className="flex items-center gap-2 px-3 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-500/30 transition-colors disabled:opacity-50"
                          >
                            {processingIds.has(suggestion.id) ? (
                              <div className="size-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <XMarkIcon className="size-4 shrink-0" aria-hidden="true" />
                            )}
                            Reject
                          </button>
                        </>
                      )}
                      {!suggestion.approved &&
                        isDuplicateOfApproved &&
                        !suggestion.duplicate && (
                          <button
                            type="button"
                            onClick={() => startDuplicateMerge(suggestion)}
                            disabled={processingIds.has(suggestion.id)}
                            className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                          >
                            <ArrowsRightLeftIcon className="size-4 shrink-0" aria-hidden="true" />
                            Duplicate
                          </button>
                        )}
                      <Button
                        variant="secondary"
                        onClick={() => startEditing(suggestion)}
                        className="flex items-center gap-2"
                      >
                        <PencilIcon className="size-4 shrink-0" aria-hidden="true" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg bg-zinc-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Edit speaker name
                </h3>
                <p className="text-sm text-zinc-400">
                  Update suggestion submitted by {editingSuggestion.email}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditing}
                aria-label="Close"
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <XMarkIcon className="size-5 shrink-0" aria-hidden="true" />
              </button>
            </div>

            <Label htmlFor="edit-speaker" className="mb-2 block">
              Speaker name
            </Label>
            <Input
              id="edit-speaker"
              type="text"
              value={editedSpeaker}
              onChange={(e) => setEditedSpeaker(e.target.value)}
              placeholder="Enter speaker name"
              maxLength={500}
            />
            {editError && (
              <p className="mt-2 text-sm text-rose-400">{editError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={closeEditing}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="inline-flex items-center gap-2"
              >
                {isSavingEdit ? (
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                )}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {duplicateSuggestion &&
        (() => {
          const pendingTokens = duplicateSuggestion.speaker
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);

          const matchingApproved = approvedSuggestions.filter(
            (approved) =>
              approved.id !== duplicateSuggestion.id &&
              approved._tokens.some((t) => pendingTokens.includes(t)),
          );

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
              <div className="w-full max-w-lg bg-zinc-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Merge duplicate
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Move votes from &ldquo;{duplicateSuggestion.speaker}
                      &rdquo; to an approved duplicate
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeDuplicateMerge}
                    aria-label="Close"
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    <XMarkIcon className="size-5 shrink-0" aria-hidden="true" />
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-zinc-300 mb-2">
                    Select which approved suggestion to merge votes into:
                  </p>
                  {matchingApproved.length === 0 ? (
                    <p className="text-sm text-zinc-500 p-3 bg-white/5 rounded-lg ring-1 ring-inset ring-white/10">
                      No matching approved suggestions found.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {matchingApproved.map((approved) => (
                        <button
                          key={approved.id}
                          type="button"
                          onClick={() => handleMergeDuplicate(approved.id)}
                          disabled={isMergingDuplicate}
                          className="w-full text-left p-3 bg-white/5 ring-1 ring-inset ring-white/10 rounded-lg hover:ring-amber-500/50 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-white font-medium truncate">
                                {approved.speaker}
                              </p>
                              <p className="text-xs text-zinc-400 mt-1">
                                {approved.votes} votes •{" "}
                                {approved.voters?.length ?? 0} voters
                              </p>
                            </div>
                            {isMergingDuplicate && (
                              <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin ml-2" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {mergeError && (
                  <p className="mt-2 text-sm text-rose-400">{mergeError}</p>
                )}

                <div className="mt-6 flex items-center justify-end gap-3">
                  <Button
                    variant="ghost"
                    onClick={closeDuplicateMerge}
                    disabled={isMergingDuplicate}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

      {editingVotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg bg-zinc-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Edit votes for {editingVotes.speaker}
                </h3>
                <p className="text-sm text-zinc-400">
                  Update the vote count directly (does not modify votes table)
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditingVotes}
                aria-label="Close"
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <XMarkIcon className="size-5 shrink-0" aria-hidden="true" />
              </button>
            </div>

            <Label htmlFor="edit-votes" className="mb-2 block">
              Vote count
            </Label>
            <Input
              id="edit-votes"
              type="number"
              value={voteCount}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 0) {
                  setVoteCount(val);
                } else if (e.target.value === "") {
                  setVoteCount(0);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSavingVoteCount) {
                  handleSaveVoteCount();
                }
              }}
              placeholder="Enter vote count"
              min="0"
              step="1"
              disabled={isSavingVoteCount}
            />
            {voteEditError && (
              <p className="mt-2 text-sm text-rose-400">{voteEditError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={closeEditingVotes}
                disabled={isSavingVoteCount}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveVoteCount}
                disabled={isSavingVoteCount}
                className="inline-flex items-center gap-2"
              >
                {isSavingVoteCount ? (
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                )}
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {spokeSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg bg-zinc-900/60 border border-white/10 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  {spokeSuggestion.spoke
                    ? `Event link for ${spokeSuggestion.speaker}`
                    : `Mark ${spokeSuggestion.speaker} as spoke`}
                </h3>
                <p className="text-sm text-zinc-400">
                  {spokeSuggestion.spoke
                    ? "Update where this suggestion's unique link redirects."
                    : "This hides the suggestion from the leaderboard and redirects its unique link."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeMarkSpoke}
                aria-label="Close"
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <XMarkIcon className="size-5 shrink-0" aria-hidden="true" />
              </button>
            </div>

            <Label htmlFor="event-link" className="mb-2 block">
              Event link (optional)
            </Label>
            <Input
              id="event-link"
              type="url"
              value={eventLinkInput}
              onChange={(e) => setEventLinkInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isSavingSpoke) {
                  handleConfirmSpoke();
                }
              }}
              placeholder="https://example.com/event"
              maxLength={2048}
              disabled={isSavingSpoke}
            />
            <p className="mt-2 text-xs text-zinc-500">
              Optional override. Leave blank to send the unique link to the
              speaker&rsquo;s archive entry (matched by name), falling back to
              the past speakers page.
            </p>
            {spokeError && (
              <p className="mt-2 text-sm text-rose-400">{spokeError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={closeMarkSpoke}
                disabled={isSavingSpoke}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirmSpoke}
                disabled={isSavingSpoke}
                className="inline-flex items-center gap-2"
              >
                {isSavingSpoke ? (
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                )}
                {spokeSuggestion.spoke ? "Save link" : "Mark Spoke"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
