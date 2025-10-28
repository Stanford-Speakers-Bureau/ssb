export default function CoSponsorships() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl py-12 px-6 sm:px-16">
          <h1 className="text-4xl font-bold text-black dark:text-white mb-8 font-serif">
            Co-Sponsorships & Partnerships
          </h1>
          
          {/* Uplift x Co-Sponsorships Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold font-serif text-black dark:text-white mb-6">
              Uplift x Co-Sponsorships
            </h2>
            
            <div className="mb-6">
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                Have an event lined up but are looking for financial support?
              </p>
              
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                We provide co-sponsorships up to $1500 in speaker fees and event service costs only. This includes honoraria, venues, or A.V., but not travel, lodging, food, etc.
              </p>
              
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                In 2020 Stanford Speakers Bureau launched our Community Uplift Fund. Money from this fund is used to support organizations on Stanford's campus who want to host events that center the voices of traditionally marginalized communities including, but not limited to, communities of color, the LGBTQ+ community, the disabled community, the neurodivergent community, and the FLI community.
              </p>
              
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                Going forward, SSB has decided to offer our Uplift Fund in perpetuity. Though we will continue to co-sponsor some events that do not meet the Uplift Fund criteria, Uplift events will be prioritized.
              </p>
              
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                We try to co-sponsor a variety of events every year, so we love creative ideas!
              </p>
            </div>
          </div>

          {/* Partnerships Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold font-serif text-black dark:text-white mb-6">
              Partnerships
            </h2>
            
            <div className="mb-6">
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-4">
                Have a budding idea for an event? Need help with finding a speaker, funding the event, advertising, etc.?
              </p>
              
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                We provide co-sponsorship contribution, and in addition, Speakers Bureau can provide extended services from the day your application is accepted to the day of your event. We have experience and expertise in finding speakers, negotiating costs, paperwork, venue booking, advertising, event staffing, and more.
              </p>
            </div>
          </div>

          {/* Application Process Section */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold font-serif text-black dark:text-white mb-6">
              Interested? Apply using the steps below!
            </h2>
            
            {/* Step 1: Review */}
            <div className="mb-8">
              <h3 className="text-2xl font-semibold font-serif text-black dark:text-white mb-4">
                1. Review
              </h3>
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-3">
                Review our Evaluating Co-Sponsorships & Partnerships document for more details on Speakers Bureau's evaluation process.
              </p>
              <a 
                href="https://docs.google.com/document/d/14YNE5wMrzkfKF-Otm_o4klpIHpqe1h5V/edit?usp=sharing_eil&rtpof=true&sd=true&ts=68fa9d1f"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[#d43d3d] hover:text-[#b32f2f] underline font-medium transition-colors"
              >
                Document Here
              </a>
            </div>

            {/* Step 2: Submit */}
            <div className="mb-8">
              <h3 className="text-2xl font-semibold font-serif text-black dark:text-white mb-4">
                2. Submit
              </h3>
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-3">
                Fill out the Co-Sponsorship & Partnership Application Google Form
              </p>
              <a 
                href="https://docs.google.com/forms/d/e/1FAIpQLSeAO0VRXyvxokpYWpFYPDg03UJ2oITF4LtWIF8GO0TIvyVIpA/viewform?usp=sharing&ouid=103384219620885640711"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-[#d43d3d] hover:text-[#b32f2f] underline font-medium transition-colors"
              >
                Document Here
              </a>
            </div>

            {/* Step 3: Present */}
            <div className="mb-8">
              <h3 className="text-2xl font-semibold font-serif text-black dark:text-white mb-4">
                3. Present
              </h3>
              <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                Present your event in one of our team meetings (5 minutes), after which we will hold a team vote on funding
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

