"use client";

import { useMemo, useState } from "react";

const REQUIRED_PHRASE = "i confirm";

type Scope = "announce" | "event";

interface Props {
  token: string;
  email: string;
  scope: Scope;
  eventName: string | null;
  alreadyUnsubscribed: boolean;
}

export default function UnsubscribeClient({
  token,
  email,
  scope,
  eventName,
  alreadyUnsubscribed,
}: Props) {
  const [phase, setPhase] = useState<"form" | "done" | "resubscribed">(
    alreadyUnsubscribed ? "done" : "form",
  );
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const headline = scope === "announce"
    ? "Unsubscribe from Stanford Speakers Bureau announcements"
    : `Unsubscribe from emails about ${eventName ?? "this event"}`;

  const description = scope === "announce"
    ? "You'll stop receiving all promotional emails about future events — announcements, \"tickets available\" notices, and general newsletters. You'll still get reminders and confirmations for events you've already got tickets to."
    : `You'll stop receiving promotional emails about ${eventName ?? "this event"} — announcements and "tickets available" notices. If you have a ticket to this event you'll still get your reminders and confirmations, and you'll keep getting emails about other events.`;

  const scopeLabel = scope === "announce"
    ? "promotional SSB emails about future events"
    : `emails about ${eventName ?? "this event"}`;

  const isPhraseValid = useMemo(
    () => confirmation.trim().toLowerCase() === REQUIRED_PHRASE,
    [confirmation],
  );

  async function handleUnsubscribe() {
    if (!isPhraseValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, confirmation }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Failed to unsubscribe");
      }
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResubscribe() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/unsubscribe/resubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Failed to resubscribe");
      }
      setPhase("resubscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        {phase === "form" && (
          <>
            <h1 className="text-xl font-semibold text-white mb-3">{headline}</h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-2">
              <span className="text-zinc-500">Email:</span>{" "}
              <span className="text-zinc-200">{email}</span>
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              {description}
            </p>

            {scope === "announce" && (
              <div className="mb-6 rounded-lg border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-xs text-amber-200/90">
                <p className="font-medium text-amber-100 mb-1">
                  Only want to skip one event?
                </p>
                <p className="leading-relaxed">
                  This stops promotional emails about every future event. If
                  you only want to stop hearing about one specific event, find
                  one of our emails about that event and use the unsubscribe
                  link in its footer instead.
                </p>
              </div>
            )}

            <label
              htmlFor="confirm"
              className="block text-sm font-medium text-zinc-300 mb-2"
            >
              Type <span className="font-mono text-white">i confirm</span> to
              unsubscribe
            </label>
            <input
              id="confirm"
              type="text"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:border-rose-500"
              placeholder="i confirm"
              disabled={submitting}
            />

            {error && (
              <p className="mt-3 text-sm text-rose-400">{error}</p>
            )}

            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={!isPhraseValid || submitting}
              className="mt-6 w-full rounded-lg bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium px-4 py-2.5 transition-colors"
            >
              {submitting ? "Unsubscribing…" : "Unsubscribe"}
            </button>

            <p className="mt-6 text-xs text-zinc-500">
              Changed your mind? Just close this page.
            </p>
          </>
        )}

        {phase === "done" && (
          <>
            <h1 className="text-xl font-semibold text-white mb-3">
              You&rsquo;ve been unsubscribed
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-2">
              <span className="text-zinc-500">Email:</span>{" "}
              <span className="text-zinc-200">{email}</span>
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              You&rsquo;ll no longer receive {scopeLabel}.
            </p>

            {error && (
              <p className="mb-3 text-sm text-rose-400">{error}</p>
            )}

            <button
              type="button"
              onClick={handleResubscribe}
              disabled={submitting}
              className="w-full rounded-lg border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 disabled:opacity-60 disabled:cursor-not-allowed text-zinc-100 font-medium px-4 py-2.5 transition-colors"
            >
              {submitting ? "Resubscribing…" : "Resubscribe"}
            </button>
          </>
        )}

        {phase === "resubscribed" && (
          <>
            <h1 className="text-xl font-semibold text-white mb-3">
              You&rsquo;re resubscribed
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              We&rsquo;ll resume sending {scopeLabel} to{" "}
              <span className="text-zinc-200">{email}</span>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
