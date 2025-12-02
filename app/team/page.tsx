import Image from "next/image";

const leadership = [
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
    name: "Katie Heffernan",
    position: "Executive Advisor to the Board",
    image: "/team/katie.jpg"
  }
];

const directors = [
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

function TeamCard({ member, large = false }: { member: typeof leadership[0]; large?: boolean }) {
  return (
    <div className="group flex flex-col items-center gap-4">
      <div 
        className={`relative ${large ? 'w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56' : 'w-32 h-32 sm:w-40 sm:h-40 md:w-44 md:h-44'} rounded-full overflow-hidden shadow-xl ring-4 ring-white dark:ring-zinc-800 group-hover:ring-[#A80D0C] transition-all duration-300`}
      >
        <Image
          src={member.image}
          alt={member.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes={large ? "(max-width: 640px) 160px, (max-width: 768px) 192px, 224px" : "(max-width: 640px) 128px, (max-width: 768px) 160px, 176px"}
        />
      </div>
      <div className="text-center px-2">
        <h3 className={`${large ? 'text-lg sm:text-xl md:text-2xl' : 'text-base sm:text-lg md:text-xl'} font-semibold text-gray-900 dark:text-white mb-1`}>
          {member.name}
        </h3>
        <p className={`${large ? 'text-sm md:text-base' : 'text-xs sm:text-sm'} text-[#A80D0C] font-medium`}>
          {member.position}
        </p>
      </div>
    </div>
  );
}

export default function Team() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black py-22 px-4 sm:px-8 md:px-16">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-[#A80D0C] font-serif tracking-tight">
            Our Team
          </h1>
          <div className="mt-4 w-24 h-1 bg-[#A80D0C] mx-auto rounded-full" />
          <p className="text-gray-600 dark:text-gray-400 mt-6 text-lg max-w-xl mx-auto leading-relaxed">
            Meet the team behind Stanford Speakers Bureau
          </p>
        </div>

        {/* Leadership Section */}
        <section className="mb-16 sm:mb-20">
          <h2 className="text-sm font-semibold tracking-widest text-gray-500 dark:text-gray-400 uppercase text-center mb-8 sm:mb-12">
            Leadership
          </h2>
          <div className="flex flex-wrap justify-center gap-8 sm:gap-12 md:gap-16 lg:gap-24">
            {leadership.map((member) => (
              <TeamCard key={member.name} member={member} large />
            ))}
          </div>
        </section>

        {/* Directors Section */}
        <section>
          <h2 className="text-sm font-semibold tracking-widest text-gray-500 dark:text-gray-400 uppercase text-center mb-8 sm:mb-12">
            Directors
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 sm:gap-10 md:gap-14 justify-items-center max-w-4xl mx-auto">
            {directors.map((member) => (
              <TeamCard key={member.name} member={member} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
