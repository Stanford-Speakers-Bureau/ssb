"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

const MotionLink = motion.create(Link);

export default function HomeClient() {
  const headingText = "Stanford Speakers Bureau";
  const headingWords = headingText.split(" ");

  return (
    <div className="flex min-h-screen flex-col items-stretch bg-zinc-50 font-sans dark:bg-black">
      <section className="relative w-full h-screen">
        <Image
          className="object-cover"
          src="/speakers/john-green.jpg"
          alt="Hero image"
          priority
          fill
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/70 pointer-events-none" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center px-8 sm:px-12 md:px-16">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold drop-shadow-2xl text-center text-[#A80D0C] font-serif mb-6 sm:mb-7 md:mb-8">
              {headingWords.map((word, wordIndex) => (
                <motion.span
                  key={wordIndex}
                  className="inline-block mr-4 last:mr-0"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: {
                      transition: {
                        delayChildren: wordIndex * 0.2,
                      },
                    },
                  }}
                >
                  {word.split("").map((char, charIndex) => (
                    <motion.span
                      key={charIndex}
                      className="inline-block"
                      variants={{
                        hidden: {
                          opacity: 0,
                          y: 50,
                          rotateX: -90,
                        },
                        visible: {
                          opacity: 1,
                          y: 0,
                          rotateX: 0,
                          transition: {
                            duration: 0.6,
                            ease: [0.43, 0.13, 0.23, 0.96],
                          },
                        },
                      }}
                    >
                      {char}
                    </motion.span>
                  ))}
                </motion.span>
              ))}
            </h1>
            <motion.p
              className="text-gray-300 text-base sm:text-lg md:text-xl max-w-3xl text-center drop-shadow-lg mb-5 sm:mb-6 md:mb-7"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.6,
                delay: 0.6,
                ease: [0.43, 0.13, 0.23, 0.96],
              }}
            >
              Stanford&#39;s largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.
            </motion.p>
            <MotionLink
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                opacity: {
                  duration: 0.6,
                  delay: 0.6,
                  ease: [0.43, 0.13, 0.23, 0.96],
                },
                y: {
                  duration: 0.6,
                  delay: 0.6,
                  ease: [0.43, 0.13, 0.23, 0.96],
                },
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              href="/suggest"
              prefetch={false}
              className="rounded px-6 py-3 text-base font-semibold text-white bg-[#A80D0C] shadow-lg transition-colors hover:bg-[#8B0A0A]"
            >
              Suggest a Speaker!
            </MotionLink>
          </div>
        </div>
      </section>

      <main className="flex w-full justify-center bg-white dark:bg-black">
        <div className="w-full max-w-[1600px] px-8 sm:px-12 md:px-16 lg:px-20 xl:px-24 py-16 sm:py-20">
          {/* Featured Speakers */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center text-[#A80D0C] mb-12 sm:mb-16 font-serif">
            Featured Past Speakers
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Mark Rober */}
            <div className="relative p-6 rounded-lg overflow-hidden min-h-[400px] flex flex-col justify-end">
              <Image
                src="/speakers/mark-rober.jpeg"
                alt="Mark Rober"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
              <div className="relative z-10">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 font-serif">
                  Mark Rober
                </h3>
                <p className="text-sm sm:text-base text-gray-200 mb-3 italic">
                  YouTube Educator, Former NASA & Apple Engineer
                </p>
                <p className="text-sm sm:text-base text-gray-100 leading-relaxed">
                  Former NASA engineer turned YouTube star with 45+ million subscribers, known for viral science and engineering videos.
                </p>
              </div>
            </div>

            {/* JoJo Siwa */}
            <div className="relative p-6 rounded-lg overflow-hidden min-h-[400px] flex flex-col justify-end">
              <Image
                src="/speakers/jojo-siwa.jpg"
                alt="JoJo Siwa"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
              <div className="relative z-10">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 font-serif">
                  JoJo Siwa
                </h3>
                <p className="text-sm sm:text-base text-gray-200 mb-3 italic">
                  Media Icon
                </p>
                <p className="text-sm sm:text-base text-gray-100 leading-relaxed">
                  Media icon, dancer, and singer who rose to fame through the reality show Dance Moms and her vibrant online presence.
                </p>
              </div>
            </div>

            {/* Mikey Day */}
            <div className="relative p-6 rounded-lg overflow-hidden min-h-[400px] flex flex-col justify-end">
              <Image
                src="/speakers/mikey-day.JPG"
                alt="Mikey Day"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
              <div className="relative z-10">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 font-serif">
                  Mikey Day
                </h3>
                <p className="text-sm sm:text-base text-gray-200 mb-3 italic">
                  SNL Cast Member
                </p>
                <p className="text-sm sm:text-base text-gray-100 leading-relaxed">
                  Saturday Night Live cast member and writer known for versatile impressions and memorable original characters.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center mb-16">
            <MotionLink
              href="/past-speakers"
              prefetch={false}
              className="rounded px-6 py-2.5 text-sm font-semibold text-white bg-[#A80D0C] shadow-lg transition-colors hover:bg-[#8B0A0A]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              View More Speakers
            </MotionLink>
          </div>

          {/* Other Programs */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center text-[#A80D0C] mb-12 sm:mb-16 font-serif">
            Other Programs
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Co-Sponsorships */}
            <div className="relative rounded-lg overflow-hidden shadow-lg min-h-[400px] flex flex-col justify-end p-6 sm:p-8">
              <Image
                src="/meeting.JPG"
                alt="Co-Sponsorships"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
              <div className="relative z-10">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4 font-serif">
                  Co-Sponsorships
                </h3>
                <p className="text-sm sm:text-base text-gray-100 leading-relaxed mb-3 sm:mb-4">
                  We provide co-sponsorships up to $1500 in speaker fees and event service costs, prioritizing our Community Uplift Fund for events centering traditionally marginalized communities.
                </p>
                <MotionLink
                  href="/other-programs"
                  prefetch={false}
                  className="text-[#A80D0C] text-sm sm:text-base font-semibold hover:underline inline-block"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Learn more
                </MotionLink>
              </div>
            </div>

            {/* Coffee Chats */}
            <div className="relative rounded-lg overflow-hidden shadow-lg min-h-[400px] flex flex-col justify-end p-6 sm:p-8">
              <Image
                src="/coffee-chat.jpg"
                alt="Coffee Chats"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/20" />
              <div className="relative z-10">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-3 sm:mb-4 font-serif">
                  Coffee Chats
                </h3>
                <p className="text-sm sm:text-base text-gray-100 leading-relaxed mb-3 sm:mb-4">
                  Join intimate conversations with Stanford professors in small groups of eight to ten students. A unique opportunity to engage with faculty in a casual, personal setting and discuss their work and insights.
                </p>
                <MotionLink
                  href="/other-programs"
                  prefetch={false}
                  className="text-[#A80D0C] text-sm sm:text-base font-semibold hover:underline inline-block"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Learn more
                </MotionLink>
              </div>
            </div>
          </div>

          {/* Contact Us Section */}
          <div className="mt-20 text-center px-6 sm:px-8">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center text-[#A80D0C] mb-6 font-serif">
              Get In Touch!
            </h2>
            <p className="text-base sm:text-lg text-zinc-700 dark:text-zinc-300 mb-8 max-w-2xl mx-auto">
              Have ideas for events or questions about our programs?
              <br className="sm:hidden" />{" "}
              <span className="whitespace-nowrap">
                We&apos;d love to hear from you!
              </span>
            </p>
            <MotionLink
              href="/contact"
              prefetch={false}
              className="inline-flex items-center gap-2 rounded px-6 py-2.5 text-sm font-semibold text-white bg-[#A80D0C] shadow-lg transition-colors hover:bg-[#8B0A0A]"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
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
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span>Contact Us</span>
            </MotionLink>
          </div>
        </div>
      </main>
    </div>
  );
}


