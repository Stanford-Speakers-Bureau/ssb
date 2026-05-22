import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getSessionUser } from "@/app/lib/auth";
import {
  getEventByRoute,
  getEventById,
  isEventMystery,
} from "@/app/lib/supabase";
import { isValidUUID } from "@/app/lib/validation";
import QuestionsHero from "./QuestionsHero";
import QuestionsLeaderboard from "./QuestionsLeaderboard";
import QuestionSubmitPanel from "./QuestionSubmitPanel";
import UserQuestionsPanel from "./UserQuestionsPanel";
import ScrollToHash from "./ScrollToHash";
import { getEventQuestions, getUserEventQuestions } from "./data";
import { getQuestionsLifecycleState } from "./lifecycle";

const getCachedEvent = cache(async (idOrRoute: string) => {
  if (isValidUUID(idOrRoute)) {
    return (await getEventById(idOrRoute)) ?? (await getEventByRoute(idOrRoute));
  }
  return getEventByRoute(idOrRoute);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventID: string }>;
}): Promise<Metadata> {
  const { eventID } = await params;
  const event = await getCachedEvent(eventID);
  if (!event || isEventMystery(event)) {
    return { title: "Moderator Q&A" };
  }
  const title = `Moderator Q&A · ${event.name}`;
  const description = `Suggest and upvote questions for ${event.name}.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Stanford Speakers Bureau",
      url: `/events/${event.route || eventID}/questions`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function EventQuestionsPage({
  params,
}: {
  params: Promise<{ eventID: string }>;
}) {
  const { eventID } = await params;
  const event = await getCachedEvent(eventID);
  if (!event) notFound();
  if (isEventMystery(event)) notFound();

  const user = await getSessionUser();
  const rankingsHidden = !!event.questions_rankings_hidden;
  const [questions, userQuestions] = await Promise.all([
    getEventQuestions(event.id, user?.email ?? null, rankingsHidden),
    getUserEventQuestions(event.id, user?.email ?? null),
  ]);

  const lifecycleState = getQuestionsLifecycleState({
    doors_open: event.doors_open,
    start_time_date: event.start_time_date,
    questions_enabled: event.questions_enabled,
  });

  return (
    <div className="flex min-h-screen flex-col bg-[var(--ssb-paper)] font-sans">
      <ScrollToHash />
      <main className="flex w-full flex-col">
        <QuestionsHero
          eventName={event.name}
          eventRoute={event.route || eventID}
        />

        <section className="relative bg-zinc-950 border-t border-zinc-900 py-12 sm:py-16 px-6 sm:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-10 lg:gap-12 items-start">
              <div>
                <QuestionsLeaderboard
                  questions={questions}
                  isLoggedIn={!!user}
                  lifecycleState={lifecycleState}
                  eventId={event.id}
                  eventRoute={event.route || eventID}
                  rankingsHidden={rankingsHidden}
                />
              </div>

              <aside className="lg:sticky lg:top-28 space-y-8">
                <div id="ask" className="scroll-mt-24 sm:scroll-mt-28">
                  <QuestionSubmitPanel
                    user={user}
                    eventId={event.id}
                    eventRoute={event.route || eventID}
                    lifecycleState={lifecycleState}
                  />
                </div>

                <UserQuestionsPanel
                  userQuestions={userQuestions}
                  isLoggedIn={!!user}
                />
              </aside>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
