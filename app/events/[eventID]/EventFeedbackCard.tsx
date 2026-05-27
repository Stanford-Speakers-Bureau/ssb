"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { FeedbackModal, Spinner, glassPanel, redButtonBase } from "./ui";

type FeedbackPayload = {
  score: number;
  comment: string | null;
  submittedAt: string;
  updatedAt: string;
};

type FeedbackApiResponse =
  | {
      eligible: true;
      via: "session" | "signed_link";
      attendeeName: string | null;
      feedback: FeedbackPayload | null;
    }
  | {
      eligible: false;
      reason: string;
      message?: string;
    };

function parseScoreParam(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed >= 1 && parsed <= 10 ? parsed : null;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

const SCORE_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

type FeedbackFormProps = {
  variant: "card" | "modal";
  loading: boolean;
  submitting: boolean;
  error: string | null;
  confirmation: string | null;
  status: FeedbackApiResponse | null;
  feedbackToken: string | null;
  eventId: string;
  pendingScore: number | null;
  comment: string;
  setComment: (comment: string) => void;
  onScoreClick: (score: number) => void;
  onCommentSave: () => void;
};

function FeedbackForm({
  variant,
  loading,
  submitting,
  error,
  confirmation,
  status,
  feedbackToken,
  eventId,
  pendingScore,
  comment,
  setComment,
  onScoreClick,
  onCommentSave,
}: FeedbackFormProps) {
  const isCard = variant === "card";
  const wrapperClass = isCard ? `${glassPanel} p-5 sm:p-6` : "";
  const wrapperId = isCard ? "feedback" : undefined;
  const [currentTimeMs] = useState(() => Date.now());
  const scoreOptions = useMemo(
    () => Array.from({ length: 10 }, (_, i) => i + 1),
    [],
  );

  if (loading) {
    if (isCard && !feedbackToken) return null;
    return (
      <div id={wrapperId} className={wrapperClass}>
        <div className="flex items-center gap-3 text-sm text-zinc-400">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-100" />
          Loading your feedback form...
        </div>
      </div>
    );
  }

  if (error && (!status || !status.eligible)) {
    return (
      <div id={wrapperId} className={wrapperClass}>
        <p className="text-sm font-medium text-rose-300">{error}</p>
      </div>
    );
  }

  if (!status || status.eligible !== true) {
    const message =
      status && !status.eligible ? (status.message ?? null) : null;
    if (isCard && (!feedbackToken || !message)) return null;
    return (
      <div id={wrapperId} className={wrapperClass}>
        <p className="text-sm font-medium text-white">
          {message ?? "Feedback isn't available right now."}
        </p>
      </div>
    );
  }

  const existingFeedback = status.feedback;
  const submittedAtMs = existingFeedback
    ? new Date(existingFeedback.submittedAt).getTime()
    : null;
  const scoreLocked =
    submittedAtMs != null &&
    currentTimeMs - submittedAtMs >= SCORE_EDIT_WINDOW_MS;
  const displayedScore = pendingScore ?? existingFeedback?.score ?? null;
  const savedComment = existingFeedback?.comment ?? "";
  const commentChanged = comment !== savedComment;

  return (
    <div id={wrapperId} className={wrapperClass}>
      <div className="flex flex-col gap-4">
        <div>
          <h3
            className={`font-semibold text-white${
              isCard ? "text-lg sm:text-xl" : "text-xl sm:text-2xl"
            }`}
          >
            How likely are you to recommend Stanford Speakers Bureau events to a
            friend?
          </h3>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        {confirmation && (
          <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {confirmation}
          </div>
        )}

        {scoreLocked && existingFeedback ? (
          <div className="rounded-xl border px-5 py-5 border-zinc-700/70 bg-zinc-800/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-400">
                  Your rating
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  Saved {formatTimestamp(existingFeedback.updatedAt)}
                </p>
              </div>
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-white">
                  {existingFeedback.score}
                </span>
                <span className="text-xl font-semibold text-zinc-500">/10</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {scoreOptions.map((score) => {
                const isActive = score === displayedScore;
                const isPending = submitting && score === pendingScore;
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => onScoreClick(score)}
                    disabled={submitting}
                    aria-label={
                      isPending
                        ? `Saving ${score} out of 10`
                        : `Rate ${score} out of 10`
                    }
                    className={`rounded-xl border px-0 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                      isActive
                        ? "border-[#A80D0C] bg-[#A80D0C] text-white"
                        : "disabled:opacity-50 border-zinc-700 bg-zinc-900/70 text-zinc-200 hover:border-[#A80D0C] hover:bg-[#A80D0C]/15"
                    }`}
                  >
                    <span className="flex h-5 items-center justify-center">
                      {isPending ? <Spinner /> : score}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Not likely</span>
              <span>Extremely likely</span>
            </div>
          </>
        )}

        {existingFeedback && (
          <div>
            <label
              htmlFor={`feedback-comment-${eventId}-${variant}`}
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Comment
            </label>
            <textarea
              id={`feedback-comment-${eventId}-${variant}`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              maxLength={1500}
              placeholder="What stood out, or what should we improve next time?"
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors border-zinc-700 bg-zinc-900/70 text-white placeholder:text-zinc-500"
            />
            <p className="mt-2 text-right text-xs text-zinc-400">
              {comment.length}/1500
            </p>
          </div>
        )}

        {existingFeedback && commentChanged && (
          <button
            type="button"
            onClick={onCommentSave}
            disabled={submitting}
            className={`${redButtonBase} disabled:opacity-50`}
          >
            {submitting
              ? "Saving..."
              : savedComment
                ? "Update Comment"
                : "Save Comment"}
          </button>
        )}

        {existingFeedback && (
          <div className="rounded-xl border px-4 py-3 text-sm border-zinc-700/70 bg-zinc-800/40 text-zinc-300">
            Want to help shape who we book next?{" "}
            <Link
              href="/suggest"
              className="font-semibold underline underline-offset-2 text-red-400 hover:text-red-300"
            >
              Suggest a speaker or upvote ideas →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventFeedbackCard({
  eventId,
  loadSessionStatus = false,
}: {
  eventId: string;
  loadSessionStatus?: boolean;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [feedbackToken] = useState<string | null>(() =>
    searchParams.get("feedback_token"),
  );
  const [emailSelectedScore] = useState<number | null>(() =>
    parseScoreParam(searchParams.get("feedback_score")),
  );

  const shouldLoadFeedbackStatus = Boolean(feedbackToken) || loadSessionStatus;

  const [loading, setLoading] = useState(shouldLoadFeedbackStatus);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [status, setStatus] = useState<FeedbackApiResponse | null>(null);
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [modalOpen, setModalOpen] = useState<boolean>(() =>
    Boolean(feedbackToken),
  );
  const autoRecordedRef = useRef(false);
  const viewTrackedRef = useRef(false);

  // Fire the feedback funnel's entry event once the eligibility status resolves:
  // `event_feedback_viewed` when the form is offered, `event_feedback_blocked`
  // (with the reason) when it isn't — so submission drop-off is measurable.
  useEffect(() => {
    if (!status || viewTrackedRef.current) return;
    viewTrackedRef.current = true;

    if (status.eligible) {
      posthog.capture("event_feedback_viewed", {
        event_id: eventId,
        via: status.via,
        is_update: !!status.feedback,
        $groups: { event: eventId },
      });
    } else {
      posthog.capture("event_feedback_blocked", {
        event_id: eventId,
        reason: status.reason,
        $groups: { event: eventId },
      });
    }
  }, [eventId, status]);

  useEffect(() => {
    let ignore = false;

    async function loadFeedbackStatus() {
      if (!shouldLoadFeedbackStatus) {
        setLoading(false);
        setError(null);
        setConfirmation(null);
        setStatus(null);
        setComment("");
        return;
      }

      setLoading(true);
      setError(null);
      setConfirmation(null);

      try {
        const params = new URLSearchParams({ eventId });
        if (feedbackToken) {
          params.set("feedback_token", feedbackToken);
        }

        const response = await fetch(`/api/feedback?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as FeedbackApiResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Failed to load feedback");
        }

        if (ignore) return;

        setStatus(data);

        if (data.eligible) {
          setComment(data.feedback?.comment ?? "");
        } else {
          setComment("");
        }
      } catch (fetchError) {
        console.error("Feedback status load error:", fetchError);
        if (!ignore) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load feedback",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadFeedbackStatus();

    return () => {
      ignore = true;
    };
  }, [eventId, feedbackToken, shouldLoadFeedbackStatus]);

  useEffect(() => {
    if (autoRecordedRef.current) return;
    if (!feedbackToken) return;
    if (!status) return;

    autoRecordedRef.current = true;
    router.replace(`${pathname}#feedback`, { scroll: false });

    if (!status.eligible) return;

    if (status.feedback) {
      setConfirmation(
        `Your rating is saved at ${status.feedback.score}/10. You can still update your comment below.`,
      );
      return;
    }

    if (emailSelectedScore == null) return;

    let ignore = false;
    setPendingScore(emailSelectedScore);
    setSubmitting(true);
    setError(null);
    void (async () => {
      try {
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId,
            score: emailSelectedScore,
            feedbackToken,
          }),
        });
        const data = (await response.json()) as {
          error?: string;
          feedback?: FeedbackPayload;
        };
        if (ignore) return;
        if (!response.ok) {
          throw new Error(data.error || "Failed to record feedback");
        }
        const savedScore = data.feedback?.score ?? emailSelectedScore;
        setStatus((prev) =>
          prev && prev.eligible
            ? { ...prev, feedback: data.feedback ?? null }
            : prev,
        );
        setConfirmation(
          `Recorded ${savedScore}/10. Add a comment below if you'd like.`,
        );
      } catch (recordError) {
        if (ignore) return;
        console.error("Feedback auto-record error:", recordError);
        setError(
          recordError instanceof Error
            ? recordError.message
            : "Failed to record feedback",
        );
      } finally {
        if (!ignore) {
          setSubmitting(false);
          setPendingScore(null);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [emailSelectedScore, eventId, feedbackToken, pathname, router, status]);

  async function handleScoreClick(score: number) {
    if (submitting) return;
    setPendingScore(score);
    setSubmitting(true);
    setError(null);
    setConfirmation(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          score,
          feedbackToken,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        feedback?: FeedbackPayload;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to save rating");
      }

      const savedScore = data.feedback?.score ?? score;
      setStatus((prev) =>
        prev && prev.eligible
          ? { ...prev, feedback: data.feedback ?? null }
          : prev,
      );
      setConfirmation(
        `Saved ${savedScore}/10. Add a comment below if you'd like.`,
      );
    } catch (scoreError) {
      console.error("Feedback score save error:", scoreError);
      setError(
        scoreError instanceof Error
          ? scoreError.message
          : "Failed to save rating",
      );
    } finally {
      setSubmitting(false);
      setPendingScore(null);
    }
  }

  async function handleCommentSave() {
    if (submitting) return;
    if (!status?.eligible || !status.feedback) return;

    const scoreToSubmit = status.feedback.score;

    setSubmitting(true);
    setError(null);
    setConfirmation(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          score: scoreToSubmit,
          comment,
          feedbackToken,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        feedback?: FeedbackPayload;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to save comment");
      }

      setStatus((prev) =>
        prev && prev.eligible
          ? { ...prev, feedback: data.feedback ?? null }
          : prev,
      );
      setComment(data.feedback?.comment ?? "");
      setConfirmation("Your comment has been saved.");
    } catch (commentError) {
      console.error("Feedback comment save error:", commentError);
      setError(
        commentError instanceof Error
          ? commentError.message
          : "Failed to save comment",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const formProps: Omit<FeedbackFormProps, "variant"> = {
    loading,
    submitting,
    error,
    confirmation,
    status,
    feedbackToken,
    eventId,
    pendingScore,
    comment,
    setComment,
    onScoreClick: handleScoreClick,
    onCommentSave: handleCommentSave,
  };

  return (
    <>
      <FeedbackForm variant="card" {...formProps} />
      {feedbackToken && (
        <FeedbackModal open={modalOpen} onClose={() => setModalOpen(false)}>
          <FeedbackForm variant="modal" {...formProps} />
        </FeedbackModal>
      )}
    </>
  );
}
