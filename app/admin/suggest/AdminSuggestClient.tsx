"use client";

import { useState } from "react";

export type Suggestion = {
  id: string;
  created_at: string;
  email: string;
  speaker: string;
  votes: number;
  approved: boolean;
  reviewed: boolean;
  duplicate?: boolean;
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
    "pending" | "approved" | "rejected" | "all"
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

  async function handleAction(id: string, action: "approve" | "reject") {
    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      const response = await fetch("/api/admin/suggestions", {
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
      const response = await fetch("/api/admin/suggestions", {
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
      const response = await fetch("/api/admin/suggestions", {
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

  async function handleSyncVotes() {
    setIsSyncingVotes(true);
    setSyncError(null);

    try {
      const response = await fetch("/api/admin/suggestions/sync-votes", {
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
      const response = await fetch("/api/admin/suggestions/votes", {
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
    { id: "all" as const, label: "All" },
  ];

  const filteredSuggestions = suggestions
    .filter((s) => {
      switch (filter) {
        case "pending":
          return !s.reviewed;
        case "approved":
          return s.reviewed && s.approved;
        case "rejected":
          return s.reviewed && !s.approved;
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
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white font-serif mb-2">
              Speaker Suggestions
            </h1>
            <p className="text-zinc-400">
              Review and manage speaker suggestions from users.
            </p>
          </div>
          <button
            onClick={handleSyncVotes}
            disabled={isSyncingVotes}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 rounded text-sm font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-50 shrink-0"
          >
            {isSyncingVotes ? (
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
            {isSyncingVotes ? "Syncing..." : "Resync Votes"}
          </button>
        </div>
        {syncError && <p className="mt-2 text-sm text-rose-400">{syncError}</p>}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded text-sm font-medium transition-all ${
              filter === tab.id
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {tab.label}
            {tab.id === "pending" &&
              filter === "pending" &&
              pendingCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-rose-500 text-white text-xs rounded-full">
                  {pendingCount}
                </span>
              )}
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {filter === "pending" && pendingCount > 0 && (
        <div className="flex gap-3 mb-6 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button
            onClick={() => handleBulkAction("approve")}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded text-sm font-medium hover:bg-emerald-500/30 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            Approve All ({pendingCount})
          </button>
          <button
            onClick={() => handleBulkAction("reject")}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded text-sm font-medium hover:bg-rose-500/30 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Reject All
          </button>
        </div>
      )}

      {/* Suggestions List */}
      {filteredSuggestions.length === 0 ? (
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
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
              />
            </svg>
          </div>
          <p className="text-zinc-400 text-lg mb-1">No suggestions found</p>
          <p className="text-zinc-600 text-sm">
            {filter === "pending"
              ? "All caught up! No pending suggestions."
              : `No ${filter} suggestions yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSuggestions.map((suggestion) => {
            const pendingTokens = suggestion.speaker
              .toLowerCase()
              .split(/\s+/)
              .filter(Boolean);

            // Find all approved suggestions whose name shares at least one token
            // Apply to both pending and rejected items
            const matchingApproved = approvedSuggestions.filter((approved) =>
              approved._tokens.some((t) => pendingTokens.includes(t)),
            );

            const isDuplicateOfApproved = matchingApproved.length > 0;

            return (
              <div
                key={suggestion.id}
                className={`bg-zinc-900 rounded-xl border p-6 transition-all ${
                  suggestion.reviewed
                    ? suggestion.approved
                      ? "border-emerald-500/30"
                      : "border-rose-500/30"
                    : "border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-white truncate">
                        {suggestion.speaker}
                      </h3>
                      {suggestion.reviewed && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            suggestion.approved
                              ? "bg-emerald-500/20 text-emerald-400"
                              : suggestion.duplicate
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {suggestion.approved
                            ? "Approved"
                            : suggestion.duplicate
                              ? "Duplicate"
                              : "Rejected"}
                        </span>
                      )}
                      {!suggestion.reviewed && isDuplicateOfApproved && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          Duplicate
                        </span>
                      )}
                      {suggestion.reviewed &&
                        !suggestion.approved &&
                        isDuplicateOfApproved &&
                        !suggestion.duplicate && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            Duplicate
                          </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                      <span className="flex items-center gap-1.5">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                        {suggestion.email}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                          />
                        </svg>
                        {suggestion.votes} votes
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {new Date(suggestion.created_at).toLocaleDateString()}
                      </span>
                    </div>
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
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-zinc-800 text-zinc-100 border border-zinc-700"
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
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5"
                            />
                          </svg>
                          <span>
                            {suggestion.voters?.length ?? 0} voter
                            {(suggestion.voters?.length ?? 0) === 1 ? "" : "s"}
                          </span>
                        </div>
                        <button
                          onClick={() => startEditingVotes(suggestion)}
                          className="text-xs px-2 py-1 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
                        >
                          Edit Votes
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
                              className="text-sm px-3 py-1 rounded-full bg-zinc-800 text-zinc-100"
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
                          onClick={() => startDuplicateMerge(suggestion)}
                          disabled={processingIds.has(suggestion.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                            />
                          </svg>
                          Duplicate
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(suggestion.id, "approve")}
                        disabled={processingIds.has(suggestion.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {processingIds.has(suggestion.id) ? (
                          <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => handleAction(suggestion.id, "reject")}
                        disabled={processingIds.has(suggestion.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded text-sm font-medium hover:bg-rose-500/30 transition-colors disabled:opacity-50"
                      >
                        {processingIds.has(suggestion.id) ? (
                          <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                        Reject
                      </button>
                      <button
                        onClick={() => startEditing(suggestion)}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-200 rounded text-sm font-medium hover:bg-zinc-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit
                      </button>
                    </div>
                  )}
                  {suggestion.reviewed && (
                    <div className="flex gap-2 shrink-0">
                      {!suggestion.approved &&
                        isDuplicateOfApproved &&
                        !suggestion.duplicate && (
                          <button
                            onClick={() => startDuplicateMerge(suggestion)}
                            disabled={processingIds.has(suggestion.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                              />
                            </svg>
                            Duplicate
                          </button>
                        )}
                      <button
                        onClick={() => startEditing(suggestion)}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-200 rounded text-sm font-medium hover:bg-zinc-700 transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Edit
                      </button>
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
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Edit Speaker Name
                </h3>
                <p className="text-sm text-zinc-400">
                  Update suggestion submitted by {editingSuggestion.email}
                </p>
              </div>
              <button
                onClick={closeEditing}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Speaker Name
            </label>
            <input
              type="text"
              value={editedSpeaker}
              onChange={(e) => setEditedSpeaker(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50"
              placeholder="Enter speaker name"
              maxLength={500}
            />
            {editError && (
              <p className="mt-2 text-sm text-rose-400">{editError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeEditing}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                {isSavingEdit ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                Save Changes
              </button>
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

          const matchingApproved = approvedSuggestions.filter((approved) =>
            approved._tokens.some((t) => pendingTokens.includes(t)),
          );

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
              <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Merge Duplicate
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Move votes from "{duplicateSuggestion.speaker}" to an
                      approved duplicate
                    </p>
                  </div>
                  <button
                    onClick={closeDuplicateMerge}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-zinc-300 mb-2">
                    Select which approved suggestion to merge votes into:
                  </p>
                  {matchingApproved.length === 0 ? (
                    <p className="text-sm text-zinc-500 p-3 bg-zinc-800 rounded">
                      No matching approved suggestions found.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {matchingApproved.map((approved) => (
                        <button
                          key={approved.id}
                          onClick={() => handleMergeDuplicate(approved.id)}
                          disabled={isMergingDuplicate}
                          className="w-full text-left p-3 bg-zinc-800 border border-zinc-700 rounded hover:border-amber-500/50 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <button
                    onClick={closeDuplicateMerge}
                    disabled={isMergingDuplicate}
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {editingVotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">
                  Edit Votes for {editingVotes.speaker}
                </h3>
                <p className="text-sm text-zinc-400">
                  Update the vote count directly (does not modify votes table)
                </p>
              </div>
              <button
                onClick={closeEditingVotes}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Vote Count
            </label>
            <input
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
              className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50"
              placeholder="Enter vote count"
              min="0"
              step="1"
              disabled={isSavingVoteCount}
            />
            {voteEditError && (
              <p className="mt-2 text-sm text-rose-400">{voteEditError}</p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeEditingVotes}
                disabled={isSavingVoteCount}
                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveVoteCount}
                disabled={isSavingVoteCount}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium bg-blue-500 hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {isSavingVoteCount ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
