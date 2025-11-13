export default function UpcomingSpeakers() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl flex flex-col py-12 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-8 font-serif">
            Upcoming Speakers
          </h1>
          
          <div className="flex flex-col">
            <p className="text-xl text-zinc-600 dark:text-zinc-400">
              No currently upcoming speakers.
            </p>
            <p className="text-base text-zinc-500 dark:text-zinc-500 mt-4">
              Check back soon for announcements about our next exciting speaker!
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

