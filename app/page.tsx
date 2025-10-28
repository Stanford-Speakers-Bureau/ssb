"use client";

import { motion } from "motion/react";
import Image from "next/image";

export default function Home() {
  const headingText = "Stanford Speakers Bureau";
  const headingWords = headingText.split(" ");
  
  const paragraphText = "Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.";
  const paragraphWords = paragraphText.split(" ");
  
  const buttonText = "Join Our Mailing List";
  const buttonWords = buttonText.split(" ");

  return (
    <div className="flex min-h-screen flex-col items-stretch bg-zinc-50 font-sans dark:bg-black">
      <section className="relative w-full aspect-[16/10]">
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
          <div className="flex flex-col items-center gap-4 px-6 sm:px-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold drop-shadow-2xl text-center text-[#d43d3d] font-serif">
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
                        staggerChildren: 0.05,
                        delayChildren: wordIndex * 0.3,
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
            <p className="text-gray-300 text-base sm:text-lg md:text-xl max-w-3xl text-center drop-shadow-lg">
              {paragraphWords.map((word, wordIndex) => (
                <motion.span
                  key={wordIndex}
                  className="inline-block mr-1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    delay: 1.2 + wordIndex * 0.08,
                    ease: [0.43, 0.13, 0.23, 0.96],
                  }}
                >
                  {word}
                </motion.span>
              ))}
            </p>
            <motion.a 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 0.6, 
                delay: 4.0,
                ease: [0.43, 0.13, 0.23, 0.96]
              }}
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }} 
              href="https://mailman.stanford.edu/mailman/listinfo/ssb-announce" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="rounded-full px-6 py-3 text-base font-semibold text-white transition-colors shadow-lg" 
              style={{ background: '#d43d3d' }}
            >
              {buttonWords.map((word, wordIndex) => (
                <motion.span
                  key={wordIndex}
                  className="inline-block mr-2 last:mr-0"
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: {
                      transition: {
                        staggerChildren: 0.04,
                        delayChildren: 4.0 + wordIndex * 0.15,
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
            </motion.a>
          </div>
        </div>
      </section>
      <main className="flex w-full justify-center bg-white dark:bg-black">
       
      </main>
    </div>
  );
}
