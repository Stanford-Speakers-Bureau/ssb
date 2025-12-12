import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl flex flex-col items-center justify-center py-12 px-6 sm:px-12 md:px-16">
          <h1 className="text-6xl sm:text-8xl font-bold text-[#A80D0C] mb-4 font-serif">
            404
          </h1>
          <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-white mb-4 font-serif text-center">
            Page Not Found
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-center mb-8 max-w-md">
            Sorry, the page you&apos;re looking for doesn&apos;t exist or has
            been moved.
          </p>
          <Link
            href="/"
            prefetch={false}
            className="inline-flex items-center gap-2 rounded px-6 py-3 text-sm font-semibold text-white bg-[#A80D0C] shadow-md transition-all hover:bg-[#C11211] hover:shadow-lg hover:scale-105 active:scale-95"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Back to Home
          </Link>
        </section>
      </main>
    </div>
  );
}
