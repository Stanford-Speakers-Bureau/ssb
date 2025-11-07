"use client";

import {redirect, useParams} from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

interface TimeUnitProps {
  value: string;
}

function TimeUnit({ value }: TimeUnitProps) {
  return (
    <div className="relative w-8 h-10 sm:w-10 sm:h-12 overflow-hidden flex items-center justify-center">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 48, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="absolute font-mono font-bold text-2xl sm:text-3xl tabular-nums"
        >
          {value.padStart(2, "0")}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

export default function EventPage() {
  const params = useParams();
  const eventID = params.eventID as string;

  if (eventID != "malala") {
    redirect('/');
  }

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [email, setEmail] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      
      // Find the next Wednesday at 1pm
      const targetDate = new Date(now);
      const daysUntilWednesday = (3 - now.getDay() + 7) % 7;
      
      if (daysUntilWednesday === 0) {
        // Today is Wednesday
        if (now.getHours() < 13) {
          // Before 1pm today
          targetDate.setHours(13, 0, 0, 0);
        } else {
          // After 1pm, target next Wednesday
          targetDate.setDate(now.getDate() + 7);
          targetDate.setHours(13, 0, 0, 0);
        }
      } else {
        // Target this coming Wednesday
        targetDate.setDate(now.getDate() + daysUntilWednesday);
        targetDate.setHours(13, 0, 0, 0);
      }

      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);

        return { days, hours, minutes, seconds };
      }

      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/api/email/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          meta: { event: "malala", source: "event_page" },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitStatus("error");
        setErrorMessage(data.error || "Failed to submit email");
        return;
      }

      setSubmitStatus("success");
      setEmail("");
    } catch (error) {
      setSubmitStatus("error");
      setErrorMessage("Network error. Please try again.");
    }
  };

  // TODO: Replace with actual event data fetching
  return (
    <div className="flex min-h-screen flex-col items-center font-sans relative" style={{
      backgroundImage: 'url(/events/malala.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      {/* Semi-transparent overlay for better text readability */}
      <div className="absolute inset-0 bg-black/70 z-0"></div>
      
      <main className="flex w-full flex-1 justify-center pt-8 md:pt-16 relative z-10">
        <section className="w-full max-w-5xl flex flex-col py-6 md:py-12 px-4 sm:px-6 md:px-12 lg:px-16">
          <div className="p-4 md:p-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4 font-serif">
              Malala Yousafzai
            </h1>
            
            <p className="text-sm sm:text-base md:text-lg text-zinc-200 mb-4 md:mb-6 italic">
              Nobel Peace Prize Laureate & Education Activist
            </p>
            
            <div className="text-sm sm:text-base text-white space-y-3 md:space-y-4 mb-6 md:mb-8">
              <p>
                Malala Yousafzai is a Pakistani human rights activist and the youngest-ever Nobel Prize laureate. She became an international advocate for girls' education after surviving a targeted assassination attempt by the Taliban in 2012 for speaking out for her right to learn.
              </p>
              <p>
                Rather than being silenced, Malala co-founded the Malala Fund, a non-profit organization dedicated to building a world where every girl can learn and lead. She is the author of the international bestseller I Am Malala and a graduate of Oxford University.
              </p>
              <p>
                Her powerful story and unwavering advocacy have grown into an international movement, making her one of the world's most prominent voices on human rights, female empowerment, and the power of education to create change.
              </p>
            </div>
            
            <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm sm:text-base text-white font-medium">
                  Tuesday, November 18th at 6:45 PM
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <a 
                  href="https://maps.app.goo.gl/T2eUTNFHt8cZjBFHA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm sm:text-base text-white font-medium underline decoration-zinc-300 decoration-1 underline-offset-2 transition-all hover:scale-105 active:scale-95 inline-block"
                >
                  CEMEX Auditorium
                </a>
              </div>
              
              <div className="flex items-center gap-2">
                <p className="text-sm sm:text-base text-white">
                  Sponsored by <span className="font-semibold">Riddell Endowed Fund</span>
                </p>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 md:px-6 py-3 md:py-4 mb-4 md:mb-6">
              <p className="text-white text-sm sm:text-base leading-relaxed">
                <span className="font-semibold">Stanford Community Only.</span> This event is exclusively for Stanford faculty and students. Valid SUNET identification will be verified at entry.
              </p>
            </div>
            
            <form className="flex flex-col gap-3 md:gap-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="signupEmail" className="text-sm sm:text-base text-white font-semibold">
                  Sign up to be notified when tickets open!
                </label>
                <p className="text-xs sm:text-sm text-zinc-300 mt-1">
                  Tickets are first come, first serve.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <input
                  type="email"
                  id="signupEmail"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  pattern=".*@stanford\.edu$"
                  title="Please enter a valid Stanford email address (@stanford.edu)"
                  className="flex-1 px-3 md:px-4 py-2 rounded-lg border border-zinc-400 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm sm:text-base text-zinc-900 bg-white/90"
                  required
                  placeholder="Enter your Stanford email"
                  autoComplete="email"
                  disabled={submitStatus === "submitting" || submitStatus === "success"}
                />
                <button
                  type="submit"
                  disabled={submitStatus === "submitting" || submitStatus === "success"}
                  className="inline-flex items-center justify-center gap-2 rounded px-4 md:px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#A80D0C] shadow-md transition-all hover:bg-[#8B0A0A] hover:shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {submitStatus === "submitting" ? "Submitting..." : submitStatus === "success" ? "Submitted!" : "Get Notified"}
                </button>
              </div>
              
              {submitStatus === "success" && (
                <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 text-green-100 text-sm">
                  ✓ Success! You'll be notified when tickets open.
                </div>
              )}
              
              {submitStatus === "error" && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-100 text-sm">
                  ✗ {errorMessage}
                </div>
              )}
            </form>
            
            <div className="mt-6 md:mt-8 flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4 text-white">
              <span className="text-lg sm:text-xl font-semibold">Tickets drop in</span>
              <div className="flex items-center gap-1.5 sm:gap-2 font-mono">
                <TimeUnit value={String(timeLeft.days)} />
                <span className="opacity-60 text-xl sm:text-2xl font-bold">:</span>
                <TimeUnit value={String(timeLeft.hours)} />
                <span className="opacity-60 text-xl sm:text-2xl font-bold">:</span>
                <TimeUnit value={String(timeLeft.minutes)} />
                <span className="opacity-60 text-xl sm:text-2xl font-bold">:</span>
                <TimeUnit value={String(timeLeft.seconds)} />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}