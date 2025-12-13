import Image from "next/image";

export default function OtherPrograms() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl lg:py-8 py-6 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-12 font-serif text-center">
            Event Sponsorship Programs
          </h1>

          {/* Community Uplift Fund Section */}
          <div className="mb-16">
            <div className="bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-800 rounded-2xl p-8 shadow-lg border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#A80D0C]/10 dark:bg-[#A80D0C]/20 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-[#A80D0C]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white">
                  Community Uplift Fund
                </h2>
              </div>

              <p className="text-base text-zinc-700 dark:text-zinc-300 mb-4">
                Since 2020, Stanford Speakers Bureau has prioritized organizations on Stanford's campus who want to host events that center the voices of traditionally marginalized communities. This includes, but is not limited to:
              </p>

              <div className="flex flex-wrap gap-2">
                {["Communities of Color", "LGBTQ+ Community", "Disabled Community", "Neurodivergent Community", "FLI Community"].map(
                  (tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 text-xs font-medium bg-[#A80D0C]/10 dark:bg-[#A80D0C]/20 text-[#A80D0C] rounded-full"
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Co-Sponsorships Section */}
          <div className="mb-16">
            <div className="bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-800 rounded-2xl p-8 shadow-lg border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#A80D0C]/10 dark:bg-[#A80D0C]/20 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-[#A80D0C]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white">
                  Co-Sponsorships
                </h2>
              </div>

              <p className="text-base text-zinc-700 dark:text-zinc-300 mb-6">
                
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
                  <h3 className="font-semibold text-lg text-black dark:text-white mb-3">
                    Funding Information
                  </h3>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 mb-6">
                    For events looking for additional funding, we'll provide up to $1,500 in monetary support!
                  </p>
                </div>
                <div className="bg-white dark:bg-zinc-800 rounded-lg p-6 border border-zinc-200 dark:border-zinc-700 mb-6">
                  <h3 className="font-semibold text-lg text-black dark:text-white mb-3">
                    Our Funding Can Support
                  </h3>
                  <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                    <li className="flex items-center gap-2">
                      <span className="text-[#A80D0C]">•</span>
                      <span>Speaker Fees (Honoraria)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#A80D0C]">•</span>
                      <span>Event Services</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#A80D0C]">•</span>
                      <span>Venue Rental</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 italic">
                  We love creative ideas and diverse events!
                </p>
                <a
                  href="mailto:ctoh28@stanford.edu,ajoshi17@stanford.edu,anishan@stanford.edu"
                  className="inline-flex items-center gap-2 text-[#A80D0C] font-semibold hover:underline"
                >
                  Questions? Contact Cindy Toh
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Partnerships Section */}
          <div className="mb-16">
            <div className="bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-900 dark:to-zinc-800 rounded-2xl p-8 shadow-lg border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#A80D0C]/10 dark:bg-[#A80D0C]/20 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-[#A80D0C]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white">
                  Partnerships
                </h2>
              </div>

              <p className="text-base text-zinc-700 dark:text-zinc-300 mb-6">
                Need help bringing your event idea to life? We'll provide full support from funding to execution.
              </p>

              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  "Finding Speakers",
                  "Honorarium Negotiations",
                  "Venue Booking",
                  "Event Advertising",
                  "Event Staffing",
                  "Speaker Contracts",
                ].map((service) => (
                  <div
                    key={service}
                    className="flex items-center gap-2 bg-white dark:bg-zinc-800 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700"
                  >
                    <svg
                      className="w-5 h-5 text-[#A80D0C] flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300">{service}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Application Process Section */}
          <div className="mb-12">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-3">
                Applying for Co-Sponsorships & Partnerships
              </h2>
              <p className="text-base text-zinc-600 dark:text-zinc-400">
                On average, the review process takes under 2 weeks. Speakers Bureau processes applications on a first-come, first-served basis and we encourage you to apply <strong>as early as possible!</strong>
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {/* Step 1: Review */}
              <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800 rounded-xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#A80D0C] text-white flex items-center justify-center font-bold text-xl font-serif flex-shrink-0">
                    1
                  </div>
                  <h3 className="text-xl font-bold font-serif text-black dark:text-white">
                    Review
                  </h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
                  Review our evaluation process document.
                </p>
                <a
                  href="https://docs.google.com/document/d/14YNE5wMrzkfKF-Otm_o4klpIHpqe1h5V/edit?usp=sharing_eil&rtpof=true&sd=true&ts=68fa9d1f"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[#A80D0C] transition-all hover:bg-[#C11211] hover:scale-105"
                >
                  View Document
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
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>

              {/* Step 2: Submit */}
              <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800 rounded-xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#A80D0C] text-white flex items-center justify-center font-bold text-xl font-serif flex-shrink-0">
                    2
                  </div>
                  <h3 className="text-xl font-bold font-serif text-black dark:text-white">
                    Submit
                  </h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4">
                  Complete the application form.
                </p>
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLSeAO0VRXyvxokpYWpFYPDg03UJ2oITF4LtWIF8GO0TIvyVIpA/viewform?usp=sharing&ouid=103384219620885640711"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[#A80D0C] transition-all hover:bg-[#C11211] hover:scale-105"
                >
                  Apply Now
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
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </a>
              </div>

              {/* Step 3: Present */}
              <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800 rounded-xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#A80D0C] text-white flex items-center justify-center font-bold text-xl font-serif flex-shrink-0">
                    3
                  </div>
                  <h3 className="text-xl font-bold font-serif text-black dark:text-white">
                    Present
                  </h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  5-minute presentation at an SSB team meeting.
                </p>
              </div>

              {/* Step 4: Get Funded */}
              <div className="bg-gradient-to-br from-white to-zinc-50 dark:from-zinc-900 dark:to-zinc-800 rounded-xl p-6 shadow-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#A80D0C] text-white flex items-center justify-center font-bold text-xl font-serif flex-shrink-0">
                    4
                  </div>
                  <h3 className="text-xl font-bold font-serif text-black dark:text-white">
                    Get Funded
                  </h3>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Receive funding and bring your event to life!
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
