import Image from "next/image";
import Link from "next/link";
import {motion} from "motion/react";

export default function Contact() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="relative flex flex-1 w-full justify-center pt-16">
        <Image
          className="object-cover blur-sm"
          src="/students.jpeg"
          alt="Students background"
          fill
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-black/70 pointer-events-none" />
        <section className="relative z-10 w-full max-w-5xl lg:py-8 py-6 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 font-serif text-center drop-shadow-lg">
            Got Questions or Ideas? Get In Touch!
          </h1>
          <h2 className="text-xl sm:text-2xl font-bold font-serif text-white mb-8 text-center drop-shadow-lg">
            We are looking for event ideas!
          </h2>
          
          <div className="mb-8">
            <p className="text-base text-gray-200 leading-relaxed mb-6 drop-shadow-md">
              If you have ideas for events or have special connections to speakers you think the Stanford community would be interested in, please send us a message!
            </p>
            
            <p className="text-base text-gray-200 leading-relaxed mb-6 drop-shadow-md">
              If you have questions on getting an event off the ground, please check the{' '}
              <a 
                href="https://ose.stanford.edu/student-orgs/event-planning" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold hover:underline"
                style={{ color: '#A80D0C' }}
              >
                Office of Student Engagement&apos;s website
              </a>.
            </p>
            
            <p className="text-base text-gray-200 leading-relaxed mb-8 drop-shadow-md">
              If you are looking for Stanford Speakers Bureau to co-sponsor an event, please first check out the{' '}
              <Link 
                href="/other-programs"
                className="font-semibold hover:underline"
                style={{ color: '#A80D0C' }}
              >
                Other Programs section
              </Link>{' '}
              for our interests and guidelines.
            </p>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white mb-6 mt-10 text-center drop-shadow-lg">
            Send a Message Below!
          </h2>

          <div className="flex justify-center">
            <a 
              href="mailto:ajoshi17@stanford.edu,anishan@stanford.edu"
              className="inline-flex items-center gap-2 rounded px-6 py-3 text-sm sm:text-base font-semibold text-white bg-[#A80D0C] transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 hover:brightness-110 hover:bg-[#8B0A0A]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>Email Us!</span>
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}

