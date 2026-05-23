"use client";

import UpcomingHero from "../UpcomingHero";
import UpcomingSpeakerCard from "@/app/components/UpcomingSpeakerCard";
import { SuggestSpeakerButton } from "../SuggestSpeakerButton";
import EmptyEventsState from "../EmptyEventsState";
import { MAILING_LIST_URL, type ThemeProps } from "./shared";

/**
 * Option 1 — the existing design, reproduced via the shared view model so it
 * can be compared side-by-side with the new directions in the picker.
 */
export default function EditorialTheme({
  vms,
  hasEvents,
  isLoggedIn,
}: ThemeProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--ssb-paper)] font-sans text-[var(--ssb-ink)]">
      <UpcomingHero hasEvents={hasEvents} />

      {hasEvents ? (
        <section className="px-6 py-16 sm:py-20 sm:px-12">
          <div className="mx-auto flex max-w-5xl flex-col gap-12">
            {vms.map((vm, i) => (
              <UpcomingSpeakerCard
                key={vm.id}
                index={i}
                name={vm.mystery ? "???" : vm.name || "???"}
                header={vm.mystery ? "Speaker: To Be Announced" : vm.header}
                dateText={vm.dateText}
                doorsOpenText={vm.doorsOpenText}
                eventTimeText={vm.eventTimeText}
                locationName={vm.locationName}
                locationUrl={vm.locationUrl}
                backgroundImageUrl={vm.imageUrl}
                ctaHref={vm.ctaHref}
                ctaText={vm.ctaText}
                mystery={vm.mystery}
                eventDateRaw={vm.revealDateRaw}
                eventId={vm.id}
                isAlreadyNotified={vm.isAlreadyNotified}
                isLoggedIn={isLoggedIn}
                capacity={vm.capacity}
                ticketsSold={vm.ticketsSold}
                reserved={vm.reserved}
              />
            ))}
          </div>
        </section>
      ) : (
        <EmptyEventsState />
      )}

      <section className="border-t border-white/10 bg-[var(--ssb-paper-strong)] px-6 py-16 sm:py-24 sm:px-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="mb-3 text-xs font-sans uppercase tracking-[0.3em] text-[#A80D0C] sm:text-sm">
            Don&rsquo;t see them?
          </p>
          <h2 className="font-serif text-3xl text-white leading-[1.05] sm:text-5xl">
            Suggest a speaker.
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-base leading-relaxed text-[#f5e8dc]/80 sm:text-lg">
            Drop a name. Top picks become the outreach list for our booking
            team. Your suggestion is what fills the calendar above.
          </p>
          <div className="mt-8">
            <SuggestSpeakerButton />
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[var(--ssb-paper)] px-6 py-16 sm:py-24 sm:px-12">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="mb-3 text-xs font-sans uppercase tracking-[0.3em] text-[#A80D0C] sm:text-sm">
            Stay in the loop
          </p>
          <h2 className="font-serif text-3xl text-white leading-[1.05] sm:text-5xl">
            Hear about every upcoming speaker.
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-base leading-relaxed text-[#f5e8dc]/80 sm:text-lg">
            One email per event. We don&rsquo;t spam. We just tell you
            who&rsquo;s coming and when tickets drop.
          </p>
          <a
            href={MAILING_LIST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex rounded-full border border-[#f2ded0]/50 bg-[#fff8f1] px-8 py-3.5 text-sm font-semibold text-[#1c1614] shadow-[0_12px_35px_rgba(0,0,0,0.18)] transition-all hover:-translate-y-0.5 hover:bg-white sm:text-base"
          >
            Join the Mailing List
          </a>
        </div>
      </section>
    </div>
  );
}
