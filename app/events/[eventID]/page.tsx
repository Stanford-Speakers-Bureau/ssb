"use client";

import {redirect, useParams} from "next/navigation";

export default function EventPage() {
  const params = useParams();
  const eventID = params.eventID as string;

  if (eventID != "malala") {
    redirect('/');
  }

  // TODO: Replace with actual event data fetching
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl flex flex-col py-12 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-8 font-serif">
            Event: {eventID}
          </h1>
          
          <div className="flex flex-col">
            <form className="flex flex-col gap-4 mb-4" onSubmit={(e) => { e.preventDefault(); /* handle sign-up */ }}>
              <label htmlFor="signupEmail" className="text-base text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                Sign up to be notified when tickets open!
              </label>
              <input
                type="email"
                id="signupEmail"
                name="email"
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#A80D0C] text-base text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800"
                required
                placeholder="Enter your Stanford email"
                autoComplete="email"
              />
              <button
                type="submit"
                className="rounded px-6 py-2 mt-2 bg-[#A80D0C] text-white font-semibold text-base shadow-md hover:bg-[#8B0A0A] transition-colors"
              >
                Sign Up
              </button>
            </form>
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              Event details coming soon.
            </p>
            <p className="text-base text-zinc-500 dark:text-zinc-500 mt-4">
              This page is for event: {eventID}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}