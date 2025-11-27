import UpcomingSpeakerCard from "../components/UpcomingSpeakerCard";

export default function UpcomingSpeakers() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl flex flex-col py-12 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-8 font-serif">
            Upcoming Speakers
          </h1>
          
          <UpcomingSpeakerCard
            name="???"
            header="Mystery Speaker — To Be Announced"
            dateTimeText="January 23rd, 2026 · Doors 7:30pm · Event 8:00pm"
            locationName="Memorial Auditorium"
            locationUrl="https://maps.app.goo.gl/oaApAEsoaqnLetZK7"
            backgroundImageUrl="/speakers/mark-rober.jpeg"
            mystery={true}
          />
        </section>
      </main>
    </div>
  );
}

