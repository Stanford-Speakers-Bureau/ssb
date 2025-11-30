"use client";

import {redirect, useParams, useSearchParams} from "next/navigation";
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
  useParams(); // Required for dynamic route
  const searchParams = useSearchParams();

  redirect('/');

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Check for callback messages in URL params
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const message = searchParams.get("message") || searchParams.get("error_message");

    if (success === "true") {
      // Defer state update to avoid synchronous setState in effect
      const timeoutId = setTimeout(() => {
        setSubmitStatus("success");
        setStatusMessage(message || "Successfully signed up! You'll be notified when tickets open.");
      }, 0);
      return () => clearTimeout(timeoutId);
    } else if (error) {
      const timeoutId = setTimeout(() => {
        setSubmitStatus("error");
        setStatusMessage(message || "An error occurred. Please try again.");
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [searchParams]);

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

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleGoogleSignIn = () => {
    window.location.href = "/api/auth/google?redirect_to=/events/malala";
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
              Speaker
            </h1>
            
            <p className="text-sm sm:text-base md:text-lg text-zinc-200 mb-4 md:mb-6 italic">
              Header
            </p>
            
            <div className="text-sm sm:text-base text-white space-y-3 md:space-y-4 mb-6 md:mb-8">
              <p>
                Desc
              </p>
              <p>
                Desc
              </p>
              <p>
                Desc
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
            
            <div className="flex flex-col gap-3 md:gap-4">
              <div>
                <label className="text-sm sm:text-base text-white font-semibold">
                  Sign up to be notified when tickets open!
                </label>
                <p className="text-xs sm:text-sm text-zinc-300 mt-1">
                  Tickets are first come, first serve. Please sign in with your Stanford email.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitStatus === "success"}
                className="inline-flex items-center justify-center gap-2 rounded px-4 md:px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#A80D0C] shadow-md transition-all hover:bg-[#8B0A0A] hover:shadow-lg hover:scale-105 active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 w-full sm:w-auto"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Stanford
              </button>
              
              {submitStatus === "success" && (
                <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 text-green-100 text-sm">
                  ✓ {statusMessage}
                </div>
              )}
              
              {submitStatus === "error" && (
                <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 text-red-100 text-sm">
                  ✗ {statusMessage}
                </div>
              )}
            </div>
            
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