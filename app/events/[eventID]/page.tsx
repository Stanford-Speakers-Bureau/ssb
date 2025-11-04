export default async function EventPage({
  params,
}: {
  params: Promise<{ eventID: string }>;
}) {
  const { eventID } = await params;

  // TODO: Replace with actual event data fetching
  // For now, display a basic event page structure
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl flex flex-col py-12 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-8 font-serif">
            Event: {eventID}
          </h1>
          
          <div className="flex flex-col">
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
