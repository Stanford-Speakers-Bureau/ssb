"use client";

import { Suspense } from "react";
import HeroSection from "./components/home/HeroSection";
import SpeakerShowcase from "./components/home/SpeakerShowcase";
import ProgramsSection from "./components/home/ProgramsSection";
import CtaSection from "./components/home/CtaSection";
import SubscribeToast from "./components/home/SubscribeToast";

export default function HomeClient() {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--ssb-paper)] font-sans text-[var(--ssb-ink)]">
      <Suspense fallback={null}>
        <SubscribeToast />
      </Suspense>
      <HeroSection />
      <SpeakerShowcase />
      <ProgramsSection />
      <CtaSection />
    </div>
  );
}
