export default function OtherPrograms() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl lg:py-8 py-6 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-8 font-serif">
            Other Programs
          </h1>

          {/* Coffee Chats Section */}
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-6">
              Coffee Chats
            </h2>

            <div className="mb-6">
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                The Coffee Chats team focuses on bringing Stanford professors in
                to intimate, eight to ten person conversations with students. To
                learn more about upcoming professors or to join the team, please
                email the Director of Coffee Chats{" "}
                <a
                  href="mailto:amock@stanford.edu"
                  className="font-semibold hover:underline"
                  style={{ color: "#A80D0C" }}
                >
                  Andrea Mock
                </a>
                .
              </p>
            </div>
          </div>

          {/* Uplift x Co-Sponsorships Section */}
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-6">
              Uplift x Co-Sponsorships
            </h2>

            <div className="mb-6">
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                Have an event lined up but are looking for financial support?
              </p>

              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                We provide co-sponsorships up to $1500 in speaker fees and event
                service costs only. This includes honoraria, venues, or A.V.,
                but not travel, lodging, food, etc.
              </p>

              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                In 2020 Stanford Speakers Bureau launched our Community Uplift
                Fund. Money from this fund is used to support organizations on
                Stanford&apos;s campus who want to host events that center the
                voices of traditionally marginalized communities including, but
                not limited to, communities of color, the LGBTQ+ community, the
                disabled community, the neurodivergent community, and the FLI
                community.
              </p>

              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                Going forward, SSB has decided to offer our Uplift Fund in
                perpetuity. Though we will continue to co-sponsor some events
                that do not meet the Uplift Fund criteria, Uplift events will be
                prioritized.
              </p>

              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                We try to co-sponsor a variety of events every year, so we love
                creative ideas!
              </p>

              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                For questions, please contact the Director of Co-Sponsorship{" "}
                <a
                  href="mailto:ctoh28@stanford.edu"
                  className="font-semibold hover:underline"
                  style={{ color: "#A80D0C" }}
                >
                  Cindy Toh
                </a>
                .
              </p>
            </div>
          </div>

          {/* Partnerships Section */}
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-6">
              Partnerships
            </h2>

            <div className="mb-6">
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                Have a budding idea for an event? Need help with finding a
                speaker, funding the event, advertising, etc.?
              </p>

              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                We provide co-sponsorship contribution, and in addition,
                Speakers Bureau can provide extended services from the day your
                application is accepted to the day of your event. We have
                experience and expertise in finding speakers, negotiating costs,
                paperwork, venue booking, advertising, event staffing, and more.
              </p>
            </div>
          </div>

          {/* Application Process Section */}
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-10 text-center">
              Interested? Apply using the steps below!
            </h2>

            <div className="relative max-w-3xl mx-auto">
              {/* Step 1: Review */}
              <div className="relative mb-8">
                <div className="relative bg-white dark:bg-zinc-900 rounded-lg p-6 sm:p-8 shadow-xl">
                  <div className="flex items-start gap-4 sm:gap-6">
                    <div className="shrink-0">
                      <span
                        className="text-3xl sm:text-4xl font-bold font-serif"
                        style={{ color: "#A80D0C" }}
                      >
                        1
                      </span>
                    </div>
                    <div className="grow pt-1">
                      <h3 className="text-xl sm:text-2xl font-bold font-serif text-black dark:text-white mb-3">
                        Review
                      </h3>
                      <p className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed mb-5">
                        Review our Evaluating Co-Sponsorships & Partnerships
                        document for more details on Speakers Bureau&apos;s
                        evaluation process.
                      </p>
                      <a
                        href="https://docs.google.com/document/d/14YNE5wMrzkfKF-Otm_o4klpIHpqe1h5V/edit?usp=sharing_eil&rtpof=true&sd=true&ts=68fa9d1f"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-semibold text-white bg-[#A80D0C] transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 hover:brightness-110 hover:bg-[#8B0A0A]"
                      >
                        <span>Review Document</span>
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
                {/* Decorative Arrow */}
                <div className="flex justify-center my-6">
                  <svg
                    className="w-10 h-10"
                    style={{ color: "#A80D0C" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>
              </div>

              {/* Step 2: Submit */}
              <div className="relative mb-8">
                <div className="relative bg-white dark:bg-zinc-900 rounded-lg p-6 sm:p-8 shadow-xl  ">
                  <div className="flex items-start gap-4 sm:gap-6">
                    <div className="flex-shrink-0">
                      <span
                        className="text-3xl sm:text-4xl font-bold font-serif"
                        style={{ color: "#A80D0C" }}
                      >
                        2
                      </span>
                    </div>
                    <div className="flex-grow pt-1">
                      <h3 className="text-xl sm:text-2xl font-bold font-serif text-black dark:text-white mb-3">
                        Submit
                      </h3>
                      <p className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed mb-5">
                        Fill out the Co-Sponsorship & Partnership Application
                        Google Form
                      </p>
                      <a
                        href="https://docs.google.com/forms/d/e/1FAIpQLSeAO0VRXyvxokpYWpFYPDg03UJ2oITF4LtWIF8GO0TIvyVIpA/viewform?usp=sharing&ouid=103384219620885640711"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded px-5 py-2.5 text-sm font-semibold text-white bg-[#A80D0C] transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 hover:brightness-110 hover:bg-[#8B0A0A]"
                      >
                        <span>Submit Application</span>
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
                {/* Decorative Arrow */}
                <div className="flex justify-center my-6">
                  <svg
                    className="w-10 h-10"
                    style={{ color: "#A80D0C" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>
              </div>

              {/* Step 3: Present */}
              <div className="relative mb-8">
                <div className="relative bg-white dark:bg-zinc-900 rounded-lg p-6 sm:p-8 shadow-xl  ">
                  <div className="flex items-start gap-4 sm:gap-6">
                    <div className="flex-shrink-0">
                      <span
                        className="text-3xl sm:text-4xl font-bold font-serif"
                        style={{ color: "#A80D0C" }}
                      >
                        3
                      </span>
                    </div>
                    <div className="flex-grow pt-1">
                      <h3 className="text-xl sm:text-2xl font-bold font-serif text-black dark:text-white mb-3">
                        Present
                      </h3>
                      <p className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        Present your event in one of our team meetings (5
                        minutes), after which we will hold a team vote on
                        funding
                      </p>
                    </div>
                  </div>
                </div>
                {/* Decorative Arrow */}
                <div className="flex justify-center my-6">
                  <svg
                    className="w-10 h-10"
                    style={{ color: "#A80D0C" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>
              </div>

              {/* Step 4: Get Funded */}
              <div className="relative">
                <div className="relative bg-white dark:bg-zinc-900 rounded-lg p-6 sm:p-8 shadow-xl  ">
                  <div className="flex items-start gap-4 sm:gap-6">
                    <div className="flex-shrink-0">
                      <span
                        className="text-3xl sm:text-4xl font-bold font-serif"
                        style={{ color: "#A80D0C" }}
                      >
                        4
                      </span>
                    </div>
                    <div className="flex-grow pt-1">
                      <h3 className="text-xl sm:text-2xl font-bold font-serif text-black dark:text-white mb-3">
                        Get Funded!
                      </h3>
                      <p className="text-base text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        Upon approval, receive funding for your event and bring
                        your vision to life with the support of Stanford
                        Speakers Bureau
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
