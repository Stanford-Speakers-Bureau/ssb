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
                delay: 1.0,
                ease: [0.43, 0.13, 0.23, 0.96],
              }}
            >
              {paragraphText}
            </motion.p>
            <motion.a 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                opacity: { duration: 0.6, delay: 1.0, ease: [0.43, 0.13, 0.23, 0.96] },
                y: { duration: 0.6, delay: 1.0, ease: [0.43, 0.13, 0.23, 0.96] },
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
        <div className="w-full max-w-7xl px-6 sm:px-8 py-16 sm:py-20">
          <motion.h2 
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-center text-[#A80D0C] mb-12 sm:mb-16 font-serif"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            Explore Our Programs
          </motion.h2>
          
          <div className="flex flex-col gap-6 sm:gap-8">
            {[
              {
                title: "Upcoming Speakers",
                description: "See who's coming to Stanford next",
                href: "/upcoming-speakers",
                icon: "🎤"
              },
              {
                title: "Past Speakers",
                description: "Explore our rich history of speakers",
                href: "/past-speakers",
                icon: "📚"
              },
              {
                title: "Other Programs",
                description: "Partner with us to bring speakers to campus",
                href: "/other-programs",
                icon: "🤝"
              },
              {
                title: "Our Team",
                description: "Meet the people behind the scenes",
                href: "/team",
                icon: "👥"
              },
              {
                title: "Contact Us",
                description: "Get in touch with questions or ideas",
                href: "/contact",
                icon: "📧"
              }
            ].map((item, index) => (
              <motion.a
                key={item.title}
                href={item.href}
                className="group relative p-8 w-full"
                whileHover={{ y: -8, scale: 1.02 }}
              >
                <div className="relative z-10">
                  <div className="text-5xl mb-4">{item.icon}</div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3 font-serif">
                    {item.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">
                    {item.description}
                  </p>
                  <div className="mt-6 flex items-center text-[#A80D0C] font-semibold text-sm group-hover:translate-x-2 transition-transform duration-300">
                    Learn More 
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
