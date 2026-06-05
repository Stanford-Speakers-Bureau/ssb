"use client";

import { useEffect, useMemo, useState } from "react";
import ArchiveHero from "./components/ArchiveHero";
import SpeakerSpotlight from "./components/SpeakerSpotlight";
import ArchiveToolbar from "./components/ArchiveToolbar";
import TimelineView from "./components/TimelineView";
import SpeakerExpanded from "./components/SpeakerExpanded";
import SpeakerDrawer from "./components/SpeakerDrawer";
import type { ViewMode } from "./components/types";
import {
  SPEAKERS,
  SPEAKER_IMAGES,
  SPOTLIGHT_SPEAKERS,
  SPEAKERS_BY_YEAR,
  YEARS,
} from "@/app/config/speakers";

export default function PastSpeakersClient() {
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  // Keep the ?speaker=<slug> query param in sync with the open drawer so the
  // current speaker is shareable/deeplinkable.
  const syncSpeakerParam = (slug: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("speaker", slug);
    else url.searchParams.delete("speaker");
    window.history.replaceState(null, "", url);
  };

  // On load, open + scroll to the deeplinked speaker (e.g. /past-speakers?speaker=slug).
  // Scroll happens before the drawer mounts, since the drawer locks body scroll.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const slug = new URLSearchParams(window.location.search).get("speaker");
    if (!slug || !SPEAKERS.some((s) => s.slug === slug)) return;
    document
      .getElementById(`speaker-${slug}`)
      ?.scrollIntoView({ block: "center" });
    setSelectedSlug(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSpeakers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SPEAKERS.filter((s) => {
      if (yearFilter && s.year !== yearFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.title?.toLowerCase().includes(q) ?? false) ||
        s.bio.toLowerCase().includes(q)
      );
    });
  }, [query, yearFilter]);

  const filteredByYear = useMemo(() => {
    return SPEAKERS_BY_YEAR.map(({ year }) => ({
      year,
      speakers: filteredSpeakers.filter((s) => s.year === year),
    }));
  }, [filteredSpeakers]);

  const spotlightSpeakers = useMemo(() => {
    return SPOTLIGHT_SPEAKERS.flatMap((s) => {
      const img = s.spotlightImage || s.image;
      return img ? [{ ...s, image: img }] : [];
    });
  }, []);

  const selectedSpeaker = selectedSlug
    ? (filteredSpeakers.find((s) => s.slug === selectedSlug) ??
      SPEAKERS.find((s) => s.slug === selectedSlug) ??
      null)
    : null;

  const navigationList = useMemo(() => {
    // If selected speaker is in the current filter, navigate within it.
    // Otherwise fall back to full list (e.g., opened from spotlight).
    if (selectedSlug && filteredSpeakers.some((s) => s.slug === selectedSlug)) {
      return filteredSpeakers;
    }
    return SPEAKERS;
  }, [selectedSlug, filteredSpeakers]);

  const selectedIndex = selectedSlug
    ? navigationList.findIndex((s) => s.slug === selectedSlug)
    : -1;

  const selectSpeaker = (slug: string | null) => {
    setSelectedSlug(slug);
    syncSpeakerParam(slug);
  };
  const openSpeaker = (slug: string) => selectSpeaker(slug);
  const closeDrawer = () => selectSpeaker(null);
  const nextSpeaker = () => {
    if (navigationList.length === 0) return;
    const next = (selectedIndex + 1) % navigationList.length;
    selectSpeaker(navigationList[next].slug);
  };
  const prevSpeaker = () => {
    if (navigationList.length === 0) return;
    const prev =
      (selectedIndex - 1 + navigationList.length) % navigationList.length;
    selectSpeaker(navigationList[prev].slug);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#140f0e] font-sans">
      <main className="flex w-full flex-col">
        <ArchiveHero speakerNames={SPEAKERS.map((s) => s.name)} />

        <SpeakerSpotlight speakers={spotlightSpeakers} onOpen={openSpeaker} />

        <ArchiveToolbar
          query={query}
          onQueryChange={setQuery}
          year={yearFilter}
          onYearChange={setYearFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          years={YEARS}
        />

        {viewMode === "timeline" ? (
          <TimelineView
            sections={filteredByYear}
            images={SPEAKER_IMAGES}
            onOpen={openSpeaker}
          />
        ) : (
          <SpeakerExpanded
            sections={filteredByYear}
            images={SPEAKER_IMAGES}
            onOpen={openSpeaker}
          />
        )}
      </main>

      <SpeakerDrawer
        speaker={selectedSpeaker}
        image={
          selectedSpeaker ? SPEAKER_IMAGES[selectedSpeaker.slug] : undefined
        }
        onClose={closeDrawer}
        onPrev={prevSpeaker}
        onNext={nextSpeaker}
        position={selectedIndex + 1}
        total={navigationList.length}
      />
    </div>
  );
}
