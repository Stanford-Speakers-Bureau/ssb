"use client";

import HeroSection from "./components/home/HeroSection";
import SpeakerShowcase from "./components/home/SpeakerShowcase";
import ProgramsSection from "./components/home/ProgramsSection";
import CtaSection from "./components/home/CtaSection";

export default function HomeClient() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans dark:bg-black">
      <HeroSection />
      <SpeakerShowcase />
      <ProgramsSection />
      <CtaSection />
    </div>
  );
}
