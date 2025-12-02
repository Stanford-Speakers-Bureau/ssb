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
  // List of voter emails for this suggestion (admin-only view)
  voters?: string[];
};

type AdminSuggestClientProps = {
  initialSuggestions: Suggestion[];
};

export default function AdminSuggestClient({
  initialSuggestions,
}: AdminSuggestClientProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null);
  const [editedSpeaker, setEditedSpeaker] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [expandedVoterPanels, setExpandedVoterPanels] = useState<Set<string>>(new Set());

  function toggleVoterPanel(id: string) {
    setExpandedVoterPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    setProcessingIds((prev) => new Set(prev).add(id));
    
    try {
      const response = await fetch("/api/admin/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });

      if (response.ok) {
        // Update local state
        setSuggestions((prev) =>
          prev.map((s) =>
            s.id === id
              ? { ...s, reviewed: true, approved: action === "approve" }
              : s
          )
        );
        
        // If on pending filter, remove the item
        if (filter === "pending") {
          setSuggestions((prev) => prev.filter((s) => s.id !== id));
        }
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
    const pendingIds = filteredSuggestions.filter((s) => !s.reviewed).map((s) => s.id);
    
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

      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === editingSuggestion.id ? { ...s, speaker: data.speaker } : s
        )
      );
      closeEditing();
    } catch (error) {
      console.error("Failed to edit suggestion:", error);
      setEditError("Failed to update speaker. Please try again.");
      setIsSavingEdit(false);
    }
  }

  const filterTabs = [
    { id: "pending" as const, label: "Pending", count: suggestions.filter((s) => !s.reviewed).length },
    { id: "approved" as const, label: "Approved" },
    { id: "rejected" as const, label: "Rejected" },
    { id: "all" as const, label: "All" },
  ];

  const filteredSuggestions = suggestions.filter((s) => {
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
  });

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white font-serif mb-2">Speaker Suggestions</h1>
        <p className="text-zinc-400">Review and manage speaker suggestions from users.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === tab.id
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {tab.label}
            {tab.id === "pending" && filter === "pending" && suggestions.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 bg-rose-500 text-white text-xs rounded-full">
                {suggestions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk Actions */}
      {filter === "pending" && suggestions.length > 0 && (
        <div className="flex gap-3 mb-6 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
          <button
            onClick={() => handleBulkAction("approve")}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Approve All ({suggestions.length})
          </button>
          <button
            onClick={() => handleBulkAction("reject")}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-500/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Reject All
          </button>
        </div>
      )}

      {/* Suggestions List */}
      {filteredSuggestions.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-zinc-400 text-lg mb-1">No suggestions found</p>
          <p className="text-zinc-600 text-sm">
            {filter === "pending" ? "All caught up! No pending suggestions." : `No ${filter} suggestions yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSuggestions.map((suggestion) => (
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
                            : "bg-rose-500/20 text-rose-400"
                        }`}
                      >
                        {suggestion.approved ? "Approved" : "Rejected"}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {suggestion.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                      {suggestion.votes} votes
                    </span>
                    <span className="flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {new Date(suggestion.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {/* Voters toggle button */}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => toggleVoterPanel(suggestion.id)}
                      className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200"
                    >
                      <svg
                        className={`w-3 h-3 transition-transform ${
                          expandedVoterPanels.has(suggestion.id) ? "rotate-90" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <span>
                        {suggestion.voters?.length ?? 0} voter
                        {(suggestion.voters?.length ?? 0) === 1 ? "" : "s"}
                      </span>
                    </button>
                    {expandedVoterPanels.has(suggestion.id) && (
                      <div className="mt-3 flex flex-wrap gap-2">
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
                    )}
                  </div>
                </div>

                {!suggestion.reviewed && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(suggestion.id, "approve")}
                      disabled={processingIds.has(suggestion.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                    >
                      {processingIds.has(suggestion.id) ? (
                        <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(suggestion.id, "reject")}
                      disabled={processingIds.has(suggestion.id)}
                      className="flex items-center gap-2 px-4 py-2 bg-rose-500/20 text-rose-400 rounded-lg text-sm font-medium hover:bg-rose-500/30 transition-colors disabled:opacity-50"
                    >
                      {processingIds.has(suggestion.id) ? (
                        <div className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      Reject
                    </button>
                    <button
                      onClick={() => startEditing(suggestion)}
                      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  </div>
                )} 
                {suggestion.reviewed && (
                  <button
                    onClick={() => startEditing(suggestion)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 text-zinc-200 rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingSuggestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Edit Speaker Name</h3>
                <p className="text-sm text-zinc-400">
                  Update suggestion submitted by {editingSuggestion.email}
                </p>
              </div>
              <button
                onClick={closeEditing}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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


