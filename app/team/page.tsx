"use client";

import { motion } from "motion/react";
import Image from "next/image";

const teamMembers = [
  {
    name: "Anish Anne",
    position: "Co-President",
    image: "/team/anish.jpg"
  },
  {
    name: "Annika Joshi",
    position: "Co-President",
    image: "/team/annika.jpg"
  },
  {
    name: "Ajay Eisenberg",
    position: "Financial Officer",
    image: "/team/ajay.jpg"
  },
  {
    name: "Suraya Mathai-Jackson",
    position: "Director of Marketing",
    image: "/team/suraya.jpg"
  },
  {
    name: "Michael Yu",
    position: "Director of Technology",
    image: "/team/michael.jpg"
  },
  {
    name: "Rishi Jeyamurthy",
    position: "Director of Socials",
    image: "/team/rishi.jpg"
  },
  {
    name: "Andrea Mock",
    position: "Director of Coffee Chats",
    image: "/team/andrea.jpg"
  },
  {
    name: "Cindy Toh",
    position: "Director of Co-Sponsorship",
    image: "/team/cindy.jpg"
  }
];

export default function Team() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black py-16 px-8 sm:px-12 md:px-16">
      <div className="max-w-7xl mx-auto">
        <motion.h1 
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-center mt-10 mb-4 text-[#d43d3d] font-serif"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.43, 0.13, 0.23, 0.96] }}
        >
          Our Team
        </motion.h1>
        
        <motion.p 
          className="text-gray-600 dark:text-gray-400 text-center mb-16 text-lg max-w-2xl mx-auto"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.43, 0.13, 0.23, 0.96] }}
        >
          Meet the team behind Stanford Speakers Bureau
        </motion.p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12 justify-items-center">
          {teamMembers.map((member, index) => (
            <motion.div
              key={member.name}
              className="flex flex-col items-center gap-4"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                duration: 0.5, 
                delay: 0.4 + index * 0.1,
                ease: [0.43, 0.13, 0.23, 0.96],
                scale: { duration: 0.2 }
              }}
              whileHover={{ scale: 1.05 }}
            >
              <div className="relative w-48 h-48 rounded-full overflow-hidden shadow-lg ring-4 ring-gray-200 dark:ring-gray-800 transition-all hover:ring-[#d43d3d]">
                <Image
                  src={member.image}
                  alt={member.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 192px, 192px"
                />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                  {member.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {member.position}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

