"use client";

import { motion } from "motion/react";
import Image from "next/image";

export default function Home() {
  const headingText = "Stanford Speakers Bureau";
  const headingWords = headingText.split(" ");
  
  const paragraphText = "Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.";
  const buttonText = "Join Our Mailing List";

  return (
    <div className="flex min-h-screen flex-col items-stretch bg-zinc-50 font-sans dark:bg-black">
      <section className="relative w-full h-screen">
        <Image
          className="object-cover"
          src="/john-green.jpg"
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
              {paragraphText}
            </motion.p>
            <motion.a 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                opacity: { duration: 0.6, delay: 0.6, ease: [0.43, 0.13, 0.23, 0.96] },
                y: { duration: 0.6, delay: 0.6, ease: [0.43, 0.13, 0.23, 0.96] },
              }}
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="https://mailman.stanford.edu/mailman/listinfo/ssb-announce" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="rounded-full px-6 py-3 text-base font-semibold text-white bg-[#A80D0C] shadow-lg transition-colors hover:bg-[#A80D0C]" 
            >
              {buttonText}
            </motion.a>
          </div>
        </div>
      </section>

      <main className="flex w-full justify-center bg-white dark:bg-black">
        <div className="w-full px-8 sm:px-12 md:px-16 lg:px-20 xl:px-24 py-16 sm:py-20">
          {/* Featured Speakers */}
          <motion.h2 
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-center text-[#A80D0C] mb-12 sm:mb-16 font-serif"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Featured Past Speakers
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Mark Rober */}
            <motion.div
              className="relative p-6 rounded-lg overflow-hidden min-h-[400px] flex flex-col justify-end"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
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
            </motion.div>

            {/* JoJo Siwa */}
            <motion.div
              className="relative p-6 rounded-lg overflow-hidden min-h-[400px] flex flex-col justify-end"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
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
            </motion.div>

            {/* Mikey Day */}
            <motion.div
              className="relative p-6 rounded-lg overflow-hidden min-h-[400px] flex flex-col justify-end"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
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
            </motion.div>
          </div>

          <div className="flex justify-center">
            <motion.a
              href="/past-speakers"
              className="rounded-full px-8 py-4 text-base font-semibold text-white bg-[#A80D0C] shadow-lg transition-colors hover:bg-[#8B0A0A]"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              View More Past Speakers
            </motion.a>
          </div>
        </div>
      </main>
    </div>
  );
}
