"use client";

import HeroSection from "./components/home/HeroSection";
import SpeakerShowcase from "./components/home/SpeakerShowcase";
import ProgramsSection from "./components/home/ProgramsSection";
import CtaSection from "./components/home/CtaSection";

export default function HomeClient() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--ssb-paper)] font-sans text-[var(--ssb-ink)]">
      <HeroSection />
      <SpeakerShowcase />
      <ProgramsSection />
      <CtaSection />
    </div>
  );
}
