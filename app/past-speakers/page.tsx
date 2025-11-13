'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export default function PastSpeakers() {
  const [expandedYears, setExpandedYears] = useState<{ [key: string]: boolean }>({
    '2025': true,
    '2024': true,
    '2023': true,
    '2022': true,
    '2021': true,
  });

  const toggleYear = (year: string) => {
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-5xl py-12 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-8 font-serif">
            Past Speakers
          </h1>
          
          {/* 2025 */}
          <div className="mb-12">
            <h2 
              className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-6 cursor-pointer flex items-center gap-2 sm:gap-3 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              onClick={() => toggleYear('2025')}
            >
              <motion.span 
                className="text-xl sm:text-2xl inline-block w-5 sm:w-6"
                initial={{ rotate: expandedYears['2025'] ? 0 : -90 }}
                animate={{ rotate: expandedYears['2025'] ? 0 : -90 }}
                transition={{ duration: 0.3 }}
              >
                ▼
              </motion.span>
              2025
            </h2>
            
            <AnimatePresence initial={false}>
              {expandedYears['2025'] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Mark Rober
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">YouTube Educator, Former NASA & Apple Engineer</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Mark Rober is an American YouTuber, engineer, and inventor. Known for his viral videos that combine science, engineering, and humor, Rober has amassed a following of over 45 million subscribers on YouTube. Before becoming a full-time content creator, he worked as an engineer for NASA&apos;s Jet Propulsion Laboratory, where he contributed to the development of the Curiosity rover, and later at Apple, where he worked on product design patents. Rober is celebrated for his creative projects and his ability to make complex scientific concepts accessible and entertaining to a broad audience.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    JoJo Siwa
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Media Icon</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    JoJo Siwa is a media icon, dancer, and singer who rose to fame through the reality show Dance Moms and her vibrant online presence. She has built a massive following across social media platforms, with over 16 million subscribers on YouTube and more than 41 million followers on TikTok. Known for her high-energy persona, signature bows, and empowering pop music, Siwa has successfully transitioned into a versatile entertainer. She has also made history as the first contestant to be paired with a same-sex partner on Dancing with the Stars.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Peter Cuneo
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Former Marvel CEO</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Peter Cuneo is an American business executive, widely recognized for his role in the turnaround of Marvel Entertainment. As CEO from 1999 to 2009, Cuneo led the company&apos;s transformation from near-bankruptcy to a highly successful entertainment powerhouse. Under his leadership, Marvel&apos;s market capitalization grew from $250 million to over $4 billion, and the company laid the foundation for the blockbuster Marvel Cinematic Universe. His business acumen and strategic vision have been credited with revitalizing the comic book giant and paving the way for its eventual acquisition by The Walt Disney Company.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Mikey Day
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">SNL Cast Member</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Mikey Day is an American comedian, writer, and actor, best known for his work as a cast member on Saturday Night Live (SNL). He joined the show as a writer in 2013 and became a featured player in 2016. Day is known for his versatile impressions and memorable original characters, including his recurring roles as a game show host and a character in the &quot;Haunted Elevator&quot; sketches with Tom Hanks. Before SNL, he was a writer and performer on shows like Maya & Marty and Wild &apos;N Out.
                  </p>
                </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2024 */}
          <div className="mb-12">
            <h2 
              className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-6 cursor-pointer flex items-center gap-2 sm:gap-3 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              onClick={() => toggleYear('2024')}
            >
              <motion.span 
                className="text-xl sm:text-2xl inline-block w-5 sm:w-6"
                initial={{ rotate: expandedYears['2024'] ? 0 : -90 }}
                animate={{ rotate: expandedYears['2024'] ? 0 : -90 }}
                transition={{ duration: 0.3 }}
              >
                ▼
              </motion.span>
              2024
            </h2>
            
            <AnimatePresence initial={false}>
              {expandedYears['2024'] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Alan Lightman
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Physicist & Author</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Alan Lightman is an American physicist, writer, and social entrepreneur. He has served on the faculties of Harvard University and Massachusetts Institute of Technology (MIT) and is currently a professor of the practice of the humanities at the Massachusetts Institute of Technology (MIT). Lightman is the author of the international bestseller Einstein&apos;s Dreams, and his novel The Diagnosis was a finalist for the National Book Award. He is also the founder of Harpswell, a nonprofit organization whose mission is to advance a new generation of women leaders in Southeast Asia. Lightman hosts the public television series Searching: Our Quest for Meaning in the Age of Science.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Richard Sherman &apos;10
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">NFL Player</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Richard Sherman is a former NFL cornerback, widely recognized for his personality and exceptional skill on the field. Sherman gained prominence as a key player for the Seattle Seahawks during their Super Bowl-winning season in 2013, becoming a cornerstone of the &quot;Legion of Boom&quot; defense. Known for his intelligence and leadership, he was a fifth-round pick from Stanford who defied the odds to become one of the top players in the league. After retiring from football, Sherman transitioned into broadcasting, becoming an analyst for Amazon&apos;s Thursday Night Football in 2022. He is also an advocate for social justice and education reform.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    John Green
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Author & YouTube Educator</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    John Green is a best-selling author and YouTuber, known for his impactful novels and educational YouTube content. His breakout novel, The Fault in Our Stars (2012), became a global sensation, spending time on the New York Times Best Seller list, landing in the top 100 best-selling books ever, and later being adapted into a successful film. Alongside his brother Hank, John co-created the popular YouTube channel Crash Course, providing free educational content to millions of students.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Phil Hellmuth
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">17x World Poker Champion</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Phil Hellmuth is known by many as the best tournament poker player ever. He has captivated fans with his amazing poker skill, and his antics on and off the table. Hellmuth is celebrated by many for his &quot;Poker Brat&quot; personality, with trash talk and flash a key part of his persona. He has won over $30,000,000 in tournament poker, and is a Palo Alto resident. After his talk, Mr. Hellmuth played a game of poker with students in SSB and the Stanford Poker Club.
                  </p>
                </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2023 */}
          <div className="mb-12">
            <h2 
              className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-6 cursor-pointer flex items-center gap-2 sm:gap-3 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              onClick={() => toggleYear('2023')}
            >
              <motion.span 
                className="text-xl sm:text-2xl inline-block w-5 sm:w-6"
                initial={{ rotate: expandedYears['2023'] ? 0 : -90 }}
                animate={{ rotate: expandedYears['2023'] ? 0 : -90 }}
                transition={{ duration: 0.3 }}
              >
                ▼
              </motion.span>
              2023
            </h2>
            
            <AnimatePresence initial={false}>
              {expandedYears['2023'] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Roxane Gay
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Author</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Roxane Gay is an acclaimed author known for her insightful and thought-provoking works that explore themes of feminism, race, and identity. She has authored several influential books, including Bad Feminist, a collection of essays that has resonated with a wide audience. Gay is celebrated for her candid writing style and her ability to address complex social issues with nuance and humor. In addition to her essays, she has written fiction, including the novel An Untamed State, opinion pieces for the New York Times, served as editor of Gay Mag, and founded Tiny Hardcore Press. Her work often challenges cultural norms and advocates for social justice.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Stuart Weitzman
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Designer</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Stuart Weitzman is a major shoe designer, who is best known for the &quot;million dollar&quot; shoes he has made for Oscar nominees and red carpet appearances. He has designed shoes for Beyonce, Taylor Swift, and other top talent. Weitzman is well-known for the unique materials in his shoes, including cork, vinyl, lucite, wallpaper, and 24-karat gold. His shoes are sold in over 70 countries. Mr. Weitzman also collects stamps, and is known for his purchase of the British Guiana 1c magenta, or the world&apos;s most famous stamp.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Kal Penn
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Actor</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Kal Penn has achieved notable success in both the entertainment industry and public service. Kal Penn has played major roles in Van Wilder, the Harold & Kumar series, and been a guest host on The Daily Show. He has also been active in public service, serving as the Associate Director of the White House Office of Public Engagement and Intergovernmental Affairs under President Obama, focusing on issues related to youth, arts, and Asian American and Pacific Islander communities. Additionally, Penn worked as a visiting lecturer in Asian American Studies at the University of Pennsylvania.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Sima Taparia
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Netflix Personality</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Sima Taparia, known by fans as Sima Aunty, is a matchmaker from Mumbai. In 2017, the documentary &apos;A Suitable Girl&apos; was released on Netflix featuring Sima Aunty finding a match for her daughter and two others winning the Best New Documentary Filmmaker award at the Tribeca Film Festival. In July 2020, the reality show &quot;Indian Matchmaking&quot; was released on Netflix, showing the process of Sima Aunty finding matches for her clients. The show was nominated for the Outstanding Unstructured Reality Program Emmy in 2021.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Preacher Lawson
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Stand-Up Comedian</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Preacher Lawson is an American comedian and actor from Portland, Oregon. He gained national recognition as a finalist on the 12th season of &quot;America&apos;s Got Talent.&quot; Lawson has since performed on numerous TV shows, including &quot;The Late Late Show with James Corden,&quot; &quot;Last Call with Carson Daly,&quot; and &quot;Conan.&quot; He has also acted in movies and TV shows, including a recurring role on the sitcom &quot;Connecting...&quot;. Known for his high-energy, observational comedy, Lawson has become a rising star in the world of comedy, captivating audiences with his dynamic stage presence and sharp humor.
                  </p>
                </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2022 */}
          <div className="mb-12">
            <h2 
              className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-6 cursor-pointer flex items-center gap-2 sm:gap-3 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              onClick={() => toggleYear('2022')}
            >
              <motion.span 
                className="text-xl sm:text-2xl inline-block w-5 sm:w-6"
                initial={{ rotate: expandedYears['2022'] ? 0 : -90 }}
                animate={{ rotate: expandedYears['2022'] ? 0 : -90 }}
                transition={{ duration: 0.3 }}
              >
                ▼
              </motion.span>
              2022
            </h2>
            
            <AnimatePresence initial={false}>
              {expandedYears['2022'] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Jennette McCurdy
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Author and Actress</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    New York Times Bestselling Author Jennette McCurdy has been showcasing her multitude of talents for over 20 years, with more than 100 credits under her belt between film and TV. Most recently, Jennette has chronicled the unflinching details surrounding her life and rise to fame in her newly released memoir &quot;I&apos;m Glad My Mom Died&quot;, which stayed at #1 on the NYT bestseller list for eight consecutive weeks. In addition to her impressive acting resume, Jennette is an accomplished creator, and has been honored as part of the 2022 TIME100 Next list.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Margaret Atwood
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Writer</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Margaret Atwood, whose work has been published in more than forty-five countries, is the author of more than fifty books of fiction, poetry, critical essays, and graphic novels. Her latest novel, The Testaments, is a co-winner of the 2019 Booker Prize. It is the long-awaited sequel to The Handmaid&apos;s Tale, now an award-winning TV series. Her other works of fiction include Cat&apos;s Eye, finalist for the 1989 Booker Prize; Alias Grace, which won the Giller Prize in Canada and the Premio Mondello in Italy; The Blind Assassin, winner of the 2000 Booker Prize; The MaddAddam Trilogy; and Hag-Seed. She is the recipient of numerous awards, including the Peace Prize of the German Book Trade, the Franz Kafka International Literary Prize, the PEN Center USA Lifetime Achievement Award, and the Los Angeles Times Innovator&apos;s Award. She lives in Toronto.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Jimmy O. Yang
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Stand-up Comedian</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Jimmy O. Yang is a Hong Kong-born American actor, stand-up comedian, and writer. He is best known for his portrayal of Jian-Yang on the HBO series &quot;Silicon Valley.&quot; Additionally, Yang has appeared in movies such as &quot;Crazy Rich Asians,&quot; &quot;The Internship,&quot; and &quot;Fantasy Island.&quot; He is also a published author, having written the memoir &quot;How to American: An Immigrant&apos;s Guide to Disappointing Your Parents.&quot; With his multifaceted talent and diverse range of roles, Jimmy O. Yang has established himself as a prominent figure in the entertainment industry.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Bill Nye
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Scientist</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Bill Nye—scientist, engineer, comedian, author and inventor—is a man with a mission: to help foster a scientifically literate society and to help people everywhere understand and appreciate the science that makes our world work. Perhaps best known as Bill Nye the Science Guy, Bill&apos;s wit and enthusiasm garnered 18 Emmy awards. Bill is also an author and frequent speaker on topics of global importance including climate change, evolution, population, space exploration, and STEM education. He is a steadfast champion of the unwavering value of critical thinking, science, and reason. Most recently, Nye was the subject of the documentary film Bill Nye: Science Guy. This behind the scenes portrait of Nye follows him as he takes off his Science Guy lab coat and takes on those who would deny climate change, evolution, and a science-based worldview.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Sadiq Khan
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Mayor of London</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Mr. Sadiq Khan was elected Mayor of London in 2016. The son of Pakistani immigrants, a bus driver and a seamstress, Mayor Khan is the first Muslim to be elected to serve as the mayor of a major Western city and has the biggest personal mandate of any politician in the UK. In 2018, he was named on TIME&apos;s list of 100 most influential people. Since his re-election last year, Mayor Khan has made addressing climate change one of his top priorities and has also focused on building affordable housing, running the city&apos;s world-class transport network, and reforming the police. Khan is strongly linked to the social democratic wing of the British Labour Party.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Louise Glück
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Poet</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Louise Glück is an acclaimed poet, having won the 2020 Nobel Prize in Literature, and authored 12 books of poetry as well as winning the Pulitzer Prize, National Book Award, and National Humanities Medal. She has held roles as an English professor at Yale and a visiting professor of creative writing at Stanford.
                  </p>
                </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 2021 */}
          <div className="mb-12">
            <h2 
              className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-6 cursor-pointer flex items-center gap-2 sm:gap-3 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              onClick={() => toggleYear('2021')}
            >
              <motion.span 
                className="text-xl sm:text-2xl inline-block w-5 sm:w-6"
                initial={{ rotate: expandedYears['2021'] ? 0 : -90 }}
                animate={{ rotate: expandedYears['2021'] ? 0 : -90 }}
                transition={{ duration: 0.3 }}
              >
                ▼
              </motion.span>
              2021
            </h2>
            
            <AnimatePresence initial={false}>
              {expandedYears['2021'] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-2">
                    Dolores Huerta
                  </h3>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Dolores Huerta is a civil rights activist and community organizer. She has worked for labor rights and social justice for over 50 years. In 1962, she and Cesar Chavez founded the United Farm Workers union. She served as Vice President and played a critical role in many of the union&apos;s accomplishments for four decades. In 2002, she received the Puffin/Nation $100,000 prize for Creative Citizenship which she used to establish the Dolores Huerta Foundation (DHF). DHF is connecting groundbreaking community-based organizing to state and national movements to register and educate voters; advocate for education reform; bring about infrastructure improvements in low-income communities; advocate for greater equality for the LGBT community; and create strong leadership development. Dolores has received numerous awards: among them The Eleanor Roosevelt Humans Rights Award from President Clinton in 1998. In 2012 President Obama bestowed Dolores with The Presidential Medal of Freedom, the highest civilian honor in the United States.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Jaboukie Young-White
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Comedian, Writer, and Filmmaker</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Jaboukie Young-White is a comedian and filmmaker from Chicago who was previously a correspondent on &quot;The Daily Show with Trevor Noah.&quot; He has performed stand up twice on &quot;The Tonight Show Starring Jimmy Fallon&quot; and recently debuted his half-hour for &quot;Comedy Central Stand-Up Presents.&quot; Previously, Jaboukie was a staff writer on Netflix&apos;s &quot;American Vandal&quot; and the animated series &quot;Big Mouth.&quot;
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Sebastian Stan
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Actor and Activist</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Sebastian Stan is an acclaimed Romanian-American actor and activist. His career started in shows such as Law and Order, Gossip Girl, and Once upon a Time. Most recently, Sebastian has become widely recognized for his interpretation of Bucky Barnes in the Marvel Cinematic Universe. Outside the spotlight, he also supports NGOs around the world to help improve the quality of life for children.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Jonathan Van Ness
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Television Personality</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Jonathan Van Ness is an Emmy-nominated television personality, podcaster, and hairstylist to the stars. They can be seen starring on Netflix&apos;s Emmy Award-winning reboot series &quot;Queer Eye,&quot; where they shine as the show&apos;s groomer, hair stylist, and self-care advocate. In addition to &quot;Queer Eye,&quot; JVN starred on the Emmy-nominated series &quot;Gay of Thrones,&quot; (Funny or Die) a witty social commentary series recapping HBO&apos;s &quot;Game of Thrones.&quot; After a worldwide comedy tour in 2019, they published &quot;Over the Top&quot; their first book and memoir.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Noam Chomsky
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Linguist, Cognitive Scientist, Political Thinker</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Professor Noam Chomsky is a distinguished linguist and political thinker. Currently, he serves as Emeritus Professor at MIT, where he worked extensively to create modern linguistics over the last few decades. Outside of academia, Professor Chomsky has become a prominent philosopher and political commentator, providing a critical eye to power structures around the world. Throughout his career, he has written dozens of books and articles on topics ranging from the structure of language to political analysis.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Dominique Morgan
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Activist, Artist, Speaker</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Dominique Morgan is an award-winning artist, activist, and TEDx speaker. As the Executive Director of Black & Pink National, the largest prison abolitionist organization in the United States, she works daily to dismantle the systems that perpetuate violence on LGBTQ/GNC people and individuals living with HIV/AIDS. Partnering her lived experience of being impacted by mass incarceration with a decade of change-making artistry, advocacy, and background in public health, she continues to work to dismantle the prison industrial complex and mitigate its impact on our communities. Dominique is a 2020 Ten Outstanding Young Americans Award recipient, NAACP Freedom Fighter Award recipient, and 2020 JM Kaplan Innovation Prize.
                  </p>
                </div>

                <div className="mb-8">
                  <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
                    Ronny Chieng
                  </h3>
                  <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">Actor and Comedian</p>
                  <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Ronny Chieng is a Malaysian actor and comedian better known for his reports in Trevor Noah&apos;s The Daily Show. Previously, he has appeared in international blockbusters such as Crazy Rich Asians and Godzilla vs. Kong. In 2019, Ronny starred in his very own Netflix stand up special titled &quot;Asian Comedian Destroys America!&quot;
                  </p>
                </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>
    </div>
  );
}

