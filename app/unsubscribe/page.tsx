import { db, emailUnsubscribes, eq, events, isNull, and } from "@ssb/db";
import { verifyUnsubscribeToken } from "@/app/lib/unsubscribe-links";
import UnsubscribeClient from "./UnsubscribeClient";

interface PageProps {
  searchParams: Promise<{ token?: string | string[] | undefined }>;
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Unsubscribe — Stanford Speakers Bureau",
};

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { token: tokenParam } = await searchParams;
  const token = typeof tokenParam === "string" ? tokenParam : null;

  if (!token) {
    return <ErrorState reason="missing" />;
  }

  const claims = await verifyUnsubscribeToken(token);
  if (!claims) {
    return <ErrorState reason="invalid" />;
  }

  let eventName: string | null = null;
  if (claims.scope === "event") {
    const event = await db.query.events.findFirst({
      where: eq(events.id, claims.eventId),
      columns: { name: true },
    });
    eventName = event?.name ?? "this event";
  }

  const existing = await db.query.emailUnsubscribes.findFirst({
    where:
      claims.scope === "event"
        ? and(
            eq(emailUnsubscribes.email, claims.email),
            eq(emailUnsubscribes.scope, "event"),
            eq(emailUnsubscribes.eventId, claims.eventId),
          )
        : and(
            eq(emailUnsubscribes.email, claims.email),
            eq(emailUnsubscribes.scope, claims.scope),
            isNull(emailUnsubscribes.eventId),
          ),
    columns: { id: true },
  });

  return (
    <UnsubscribeClient
      token={token}
      email={claims.email}
      scope={claims.scope}
      eventName={eventName}
      alreadyUnsubscribed={!!existing}
    />
  );
}

function ErrorState({ reason }: { reason: "missing" | "invalid" }) {
  const heading =
    reason === "missing" ? "No unsubscribe token" : "Link expired or invalid";
  const body =
    reason === "missing"
      ? "This page expects an unsubscribe link from one of our emails. If you copied the URL by hand, please use the link in the email instead."
      : "This unsubscribe link is no longer valid. It may have expired, or the URL may have been edited. To stop receiving emails, please reply to one of our messages or contact tickets@stanfordspeakersbureau.com.";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-white mb-3">{heading}</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">{body}</p>
        <p className="mt-6 text-xs text-zinc-500">
          Need help? Email{" "}
          <a
            className="text-zinc-300 underline underline-offset-2 hover:text-white"
            href="mailto:tickets@stanfordspeakersbureau.com"
          >
            tickets@stanfordspeakersbureau.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}
