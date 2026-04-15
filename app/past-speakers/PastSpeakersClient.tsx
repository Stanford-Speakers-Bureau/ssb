"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";

type Speaker = {
  slug: string;
  name: string;
  title?: string;
  bio: string;
  videoUrl?: string;
  videoLabel?: string;
};

type YearGroup = {
  year: string;
  speakers: Speaker[];
};

const SPEAKER_IMAGES: Record<string, string> = {
  "malala-yousafzai": "/speakers/malala-yousafzai.jpg",
  "hasan-minhaj": "/speakers/hasan-minhaj.jpg",
  "jojo-siwa": "/speakers/jojo-siwa.jpg",
  "mark-rober": "/speakers/mark-rober.jpeg",
  "john-green": "/speakers/john-green.jpg",
};

const SPEAKERS_BY_YEAR: YearGroup[] = [
  {
    year: "2026",
    speakers: [
      {
        slug: "malala-yousafzai",
        name: "Malala Yousafzai",
        title: "Nobel Peace Prize Laureate",
        bio: "Malala Yousafzai is a human rights activist and advocate for girls' education and women's rights. She is the youngest Nobel Peace Prize laureate, receiving the prize at only 17 years old. Malala is also an acclaimed author of two books, with her most recent being Finding My Way, a memoir on her experiences at Oxford University and discovering her identity.",
      },
      {
        slug: "bernie-sanders",
        name: "Bernie Sanders",
        title: "U.S. Senator from Vermont",
        bio: "Bernie Sanders is the longest-serving independent in congressional history, currently serving as U.S. Senator from Vermont. He previously served in the House of Representatives for 16 years. Sanders ran for the Democratic presidential nomination in 2016 and 2020, becoming one of the most prominent progressive voices in American politics. He is known for his decades-long advocacy on issues including income inequality, universal healthcare, climate change, and campaign finance reform. He served as chair of the Senate Budget Committee and has authored several books, including The Speech and Our Revolution.",
        videoUrl: "https://youtu.be/Wx18tNmNYbE?t=712",
        videoLabel: "Watch Livestream →",
      },
      {
        slug: "ro-khanna",
        name: "Ro Khanna",
        title: "U.S. Representative, California's 17th Congressional District",
        bio: "Ro Khanna represents California's 17th Congressional District, which encompasses the heart of Silicon Valley. A progressive Democrat, Khanna serves on the House Armed Services Committee and the House Oversight Committee, and has been a leading voice on technology policy, economic justice, and foreign policy reform. Before entering Congress, he taught economics at Stanford University and law at Santa Clara University. He is the author of Dignity in a Digital Age and Entrepreneurial Nation, and has championed initiatives to bring tech jobs to underserved communities across America.",
      },
      {
        slug: "hasan-minhaj",
        name: "Hasan Minhaj",
        title: "Comedian, Writer, and Former Host of \"The Patriot Act\"",
        bio: "Hasan Minhaj is a two-time Peabody Award-Winning comedian best known for his breakout Netflix special Homecoming King and his critically acclaimed, political satire show Patriot Act With Hasan Minhaj for Netflix which won a Peabody, an Emmy, and a Television Academy Honor. His second one-hour comedy special The King's Jester premiered on Netflix in 2022. In October 2024, Hasan released his third comedy special on Netflix, titled Off With His Head. On Hasan's ongoing digital series and podcast, Hasan Minhaj Doesn't Know, he sits down with the biggest names in politics, culture, and tech with questions that are as thought provoking as they are absurd. In the debut episode, Hasan spoke with Senator Elizabeth Warren, and he's also welcomed John M. Chu, JJ Redick, Bernie Sanders, and Stacey Abrams, among many others",
      },
    ],
  },
  {
    year: "2025",
    speakers: [
      {
        slug: "mark-rober",
        name: "Mark Rober",
        title: "YouTube Educator, Former NASA & Apple Engineer",
        bio: "Mark Rober is an American YouTuber, engineer, and inventor. Known for his viral videos that combine science, engineering, and humor, Rober has amassed a following of over 45 million subscribers on YouTube. Before becoming a full-time content creator, he worked as an engineer for NASA's Jet Propulsion Laboratory, where he contributed to the development of the Curiosity rover, and later at Apple, where he worked on product design patents. Rober is celebrated for his creative projects and his ability to make complex scientific concepts accessible and entertaining to a broad audience.",
      },
      {
        slug: "jojo-siwa",
        name: "JoJo Siwa",
        title: "Media Icon",
        bio: "JoJo Siwa is a media icon, dancer, and singer who rose to fame through the reality show Dance Moms and her vibrant online presence. She has built a massive following across social media platforms, with over 16 million subscribers on YouTube and more than 41 million followers on TikTok. Known for her high-energy persona, signature bows, and empowering pop music, Siwa has successfully transitioned into a versatile entertainer. She has also made history as the first contestant to be paired with a same-sex partner on Dancing with the Stars.",
      },
      {
        slug: "peter-cuneo",
        name: "Peter Cuneo",
        title: "Former Marvel CEO",
        bio: "Peter Cuneo is an American business executive, widely recognized for his role in the turnaround of Marvel Entertainment. As CEO from 1999 to 2009, Cuneo led the company's transformation from near-bankruptcy to a highly successful entertainment powerhouse. Under his leadership, Marvel's market capitalization grew from $250 million to over $4 billion, and the company laid the foundation for the blockbuster Marvel Cinematic Universe. His business acumen and strategic vision have been credited with revitalizing the comic book giant and paving the way for its eventual acquisition by The Walt Disney Company.",
      },
      {
        slug: "mikey-day",
        name: "Mikey Day",
        title: "SNL Cast Member",
        bio: "Mikey Day is an American comedian, writer, and actor, best known for his work as a cast member on Saturday Night Live (SNL). He joined the show as a writer in 2013 and became a featured player in 2016. Day is known for his versatile impressions and memorable original characters, including his recurring roles as a game show host and a character in the \"Haunted Elevator\" sketches with Tom Hanks. Before SNL, he was a writer and performer on shows like Maya & Marty and Wild 'N Out.",
      },
    ],
  },
  {
    year: "2024",
    speakers: [
      {
        slug: "alan-lightman",
        name: "Alan Lightman",
        title: "Physicist & Author",
        bio: "Alan Lightman is an American physicist, writer, and social entrepreneur. He has served on the faculties of Harvard University and Massachusetts Institute of Technology (MIT) and is currently a professor of the practice of the humanities at the Massachusetts Institute of Technology (MIT). Lightman is the author of the international bestseller Einstein's Dreams, and his novel The Diagnosis was a finalist for the National Book Award. He is also the founder of Harpswell, a nonprofit organization whose mission is to advance a new generation of women leaders in Southeast Asia. Lightman hosts the public television series Searching: Our Quest for Meaning in the Age of Science.",
      },
      {
        slug: "richard-sherman",
        name: "Richard Sherman '10",
        title: "NFL Player",
        bio: "Richard Sherman is a former NFL cornerback, widely recognized for his personality and exceptional skill on the field. Sherman gained prominence as a key player for the Seattle Seahawks during their Super Bowl-winning season in 2013, becoming a cornerstone of the \"Legion of Boom\" defense. Known for his intelligence and leadership, he was a fifth-round pick from Stanford who defied the odds to become one of the top players in the league. After retiring from football, Sherman transitioned into broadcasting, becoming an analyst for Amazon's Thursday Night Football in 2022. He is also an advocate for social justice and education reform.",
      },
      {
        slug: "john-green",
        name: "John Green",
        title: "Author & YouTube Educator",
        bio: "John Green is a best-selling author and YouTuber, known for his impactful novels and educational YouTube content. His breakout novel, The Fault in Our Stars (2012), became a global sensation, spending time on the New York Times Best Seller list, landing in the top 100 best-selling books ever, and later being adapted into a successful film. Alongside his brother Hank, John co-created the popular YouTube channel Crash Course, providing free educational content to millions of students.",
      },
      {
        slug: "phil-hellmuth",
        name: "Phil Hellmuth",
        title: "17x World Poker Champion",
        bio: "Phil Hellmuth is known by many as the best tournament poker player ever. He has captivated fans with his amazing poker skill, and his antics on and off the table. Hellmuth is celebrated by many for his \"Poker Brat\" personality, with trash talk and flash a key part of his persona. He has won over $30,000,000 in tournament poker, and is a Palo Alto resident. After his talk, Mr. Hellmuth played a game of poker with students in SSB and the Stanford Poker Club.",
      },
    ],
  },
  {
    year: "2023",
    speakers: [
      {
        slug: "roxane-gay",
        name: "Roxane Gay",
        title: "Author",
        bio: "Roxane Gay is an acclaimed author known for her insightful and thought-provoking works that explore themes of feminism, race, and identity. She has authored several influential books, including Bad Feminist, a collection of essays that has resonated with a wide audience. Gay is celebrated for her candid writing style and her ability to address complex social issues with nuance and humor. In addition to her essays, she has written fiction, including the novel An Untamed State, opinion pieces for the New York Times, served as editor of Gay Mag, and founded Tiny Hardcore Press. Her work often challenges cultural norms and advocates for social justice.",
      },
      {
        slug: "stuart-weitzman",
        name: "Stuart Weitzman",
        title: "Designer",
        bio: "Stuart Weitzman is a major shoe designer, who is best known for the \"million dollar\" shoes he has made for Oscar nominees and red carpet appearances. He has designed shoes for Beyonce, Taylor Swift, and other top talent. Weitzman is well-known for the unique materials in his shoes, including cork, vinyl, lucite, wallpaper, and 24-karat gold. His shoes are sold in over 70 countries. Mr. Weitzman also collects stamps, and is known for his purchase of the British Guiana 1c magenta, or the world's most famous stamp.",
      },
      {
        slug: "kal-penn",
        name: "Kal Penn",
        title: "Actor",
        bio: "Kal Penn has achieved noteworthy success in both the entertainment industry and public service. Kal Penn has played major roles in Van Wilder, the Harold & Kumar series, and been a guest host on The Daily Show. He has also been active in public service, serving as the Associate Director of the White House Office of Public Engagement and Intergovernmental Affairs under President Obama, focusing on issues related to youth, arts, and Asian American and Pacific Islander communities. Additionally, Penn worked as a visiting lecturer in Asian American Studies at the University of Pennsylvania.",
      },
      {
        slug: "sima-taparia",
        name: "Sima Taparia",
        title: "Netflix Personality",
        bio: "Sima Taparia, known by fans as Sima Aunty, is a matchmaker from Mumbai. In 2017, the documentary 'A Suitable Girl' was released on Netflix featuring Sima Aunty finding a match for her daughter and two others winning the Best New Documentary Filmmaker award at the Tribeca Film Festival. In July 2020, the reality show \"Indian Matchmaking\" was released on Netflix, showing the process of Sima Aunty finding matches for her clients. The show was nominated for the Outstanding Unstructured Reality Program Emmy in 2021.",
      },
      {
        slug: "preacher-lawson",
        name: "Preacher Lawson",
        title: "Stand-Up Comedian",
        bio: "Preacher Lawson is an American comedian and actor from Portland, Oregon. He gained national recognition as a finalist on the 12th season of \"America's Got Talent.\" Lawson has since performed on numerous TV shows, including \"The Late Late Show with James Corden,\" \"Last Call with Carson Daly,\" and \"Conan.\" He has also acted in movies and TV shows, including a recurring role on the sitcom \"Connecting...\". Known for his high-energy, observational comedy, Lawson has become a rising star in the world of comedy, captivating audiences with his dynamic stage presence and sharp humor.",
      },
    ],
  },
  {
    year: "2022",
    speakers: [
      {
        slug: "jennette-mccurdy",
        name: "Jennette McCurdy",
        title: "Author and Actress",
        bio: "New York Times Bestselling Author Jennette McCurdy has been showcasing her multitude of talents for over 20 years, with more than 100 credits under her belt between film and TV. Most recently, Jennette has chronicled the unflinching details surrounding her life and rise to fame in her newly released memoir \"I'm Glad My Mom Died\", which stayed at #1 on the NYT bestseller list for eight consecutive weeks. In addition to her impressive acting resume, Jennette is an accomplished creator, and has been honored as part of the 2022 TIME100 Next list.",
      },
      {
        slug: "margaret-atwood",
        name: "Margaret Atwood",
        title: "Writer",
        bio: "Margaret Atwood, whose work has been published in more than forty-five countries, is the author of more than fifty books of fiction, poetry, critical essays, and graphic novels. Her latest novel, The Testaments, is a co-winner of the 2019 Booker Prize. It is the long-awaited sequel to The Handmaid's Tale, now an award-winning TV series. Her other works of fiction include Cat's Eye, finalist for the 1989 Booker Prize; Alias Grace, which won the Giller Prize in Canada and the Premio Mondello in Italy; The Blind Assassin, winner of the 2000 Booker Prize; The MaddAddam Trilogy; and Hag-Seed. She is the recipient of numerous awards, including the Peace Prize of the German Book Trade, the Franz Kafka International Literary Prize, the PEN Center USA Lifetime Achievement Award, and the Los Angeles Times Innovator's Award. She lives in Toronto.",
      },
      {
        slug: "jimmy-o-yang",
        name: "Jimmy O. Yang",
        title: "Stand-up Comedian",
        bio: "Jimmy O. Yang is a Hong Kong-born American actor, stand-up comedian, and writer. He is best known for his portrayal of Jian-Yang on the HBO series \"Silicon Valley.\" Additionally, Yang has appeared in movies such as \"Crazy Rich Asians,\" \"The Internship,\" and \"Fantasy Island.\" He is also a published author, having written the memoir \" How to American: An Immigrant's Guide to Disappointing Your Parents.\" With his multifaceted talent and diverse range of roles, Jimmy O. Yang has established himself as a prominent figure in the entertainment industry.",
      },
      {
        slug: "bill-nye",
        name: "Bill Nye",
        title: "Scientist",
        bio: "Bill Nye—scientist, engineer, comedian, author and inventor—is a man with a mission: to help foster a scientifically literate society and to help people everywhere understand and appreciate the science that makes our world work. Perhaps best known as Bill Nye the Science Guy, Bill's wit and enthusiasm garnered 18 Emmy awards. Bill is also an author and frequent speaker on topics of global importance including climate change, evolution, population, space exploration, and STEM education. He is a steadfast champion of the unwavering value of critical thinking, science, and reason. Most recently, Nye was the subject of the documentary film Bill Nye: Science Guy. This behind the scenes portrait of Nye follows him as he takes off his Science Guy lab coat and takes on those who would deny climate change, evolution, and a science-based worldview.",
      },
      {
        slug: "sadiq-khan",
        name: "Sadiq Khan",
        title: "Mayor of London",
        bio: "Mr. Sadiq Khan was elected Mayor of London in 2016. The son of Pakistani immigrants, a bus driver and a seamstress, Mayor Khan is the first Muslim to be elected to serve as the mayor of a major Western city and has the biggest personal mandate of any politician in the UK. In 2018, he was named on TIME's list of 100 most influential people. Since his re-election last year, Mayor Khan has made addressing climate change one of his top priorities and has also focused on building affordable housing, running the city's world-class transport network, and reforming the police. Khan is strongly linked to the social democratic wing of the British Labour Party.",
      },
      {
        slug: "louise-gluck",
        name: "Louise Glück",
        title: "Poet",
        bio: "Louise Glück is an acclaimed poet, having won the 2020 Nobel Prize in Literature, and authored 12 books of poetry as well as winning the Pulitzer Prize, National Book Award, and National Humanities Medal. She has held roles as an English professor at Yale and a visiting professor of creative writing at Stanford.",
      },
    ],
  },
  {
    year: "2021",
    speakers: [
      {
        slug: "dolores-huerta",
        name: "Dolores Huerta",
        bio: "Dolores Huerta is a civil rights activist and community organizer. She has worked for labor rights and social justice for over 50 years. In 1962, she and Cesar Chavez founded the United Farm Workers union. She served as Vice President and played a critical role in many of the union's accomplishments for four decades. In 2002, she received the Puffin/Nation $100,000 prize for Creative Citizenship which she used to establish the Dolores Huerta Foundation (DHF). DHF is connecting groundbreaking community-based organizing to state and national movements to register and educate voters; advocate for education reform; bring about infrastructure improvements in low-income communities; advocate for greater equality for the LGBT community; and create strong leadership development. Dolores has received numerous awards: among them The Eleanor Roosevelt Humans Rights Award from President Clinton in 1998. In 2012 President Obama bestowed Dolores with The Presidential Medal of Freedom, the highest civilian honor in the United States.",
      },
      {
        slug: "jaboukie-young-white",
        name: "Jaboukie Young-White",
        title: "Comedian, Writer, and Filmmaker",
        bio: "Jaboukie Young-White is a comedian and filmmaker from Chicago who was previously a correspondent on \"The Daily Show with Trevor Noah.\" He has performed stand up twice on \"The Tonight Show Starring Jimmy Fallon\" and recently debuted his half-hour for \"Comedy Central Stand-Up Presents.\" Previously, Jaboukie was a staff writer on Netflix's \" American Vandal\" and the animated series \"Big Mouth.\"",
      },
      {
        slug: "sebastian-stan",
        name: "Sebastian Stan",
        title: "Actor and Activist",
        bio: "Sebastian Stan is an acclaimed Romanian-American actor and activist. His career started in shows such as Law and Order, Gossip Girl, and Once upon a Time. Most recently, Sebastian has become widely recognized for his interpretation of Bucky Barnes in the Marvel Cinematic Universe. Outside the spotlight, he also supports NGOs around the world to help improve the quality of life for children.",
      },
      {
        slug: "jonathan-van-ness",
        name: "Jonathan Van Ness",
        title: "Television Personality",
        bio: "Jonathan Van Ness is an Emmy-nominated television personality, podcaster, and hairstylist to the stars. They can be seen starring on Netflix's Emmy Award-winning reboot series \"Queer Eye,\" where they shine as the show's groomer, hair stylist, and self-care advocate. In addition to \"Queer Eye,\" JVN starred on the Emmy-nominated series \"Gay of Thrones,\" (Funny or Die) a witty social commentary series recapping HBO's \"Game of Thrones.\" After a worldwide comedy tour in 2019, they published \"Over the Top\" their first book and memoir.",
      },
      {
        slug: "noam-chomsky",
        name: "Noam Chomsky",
        title: "Linguist, Cognitive Scientist, Political Thinker",
        bio: "Professor Noam Chomsky is a distinguished linguist and political thinker. Currently, he serves as Emeritus Professor at MIT, where he worked extensively to create modern linguistics over the last few decades. Outside of academia, Professor Chomsky has become a prominent philosopher and political commentator, providing a critical eye to power structures around the world. Throughout his career, he has written dozens of books and articles on topics ranging from the structure of language to political analysis.",
      },
      {
        slug: "dominique-morgan",
        name: "Dominique Morgan",
        title: "Activist, Artist, Speaker",
        bio: "Dominique Morgan is an award-winning artist, activist, and TEDx speaker. As the Executive Director of Black & Pink National, the largest prison abolitionist organization in the United States, she works daily to dismantle the systems that perpetuate violence on LGBTQ/GNC people and individuals living with HIV/AIDS. Partnering her lived experience of being impacted by mass incarceration with a decade of change-making artistry, advocacy, and background in public health, she continues to work to dismantle the prison industrial complex and mitigate its impact on our communities. Dominique is a 2020 Ten Outstanding Young Americans Award recipient, NAACP Freedom Fighter Award recipient, and 2020 JM Kaplan Innovation Prize.",
      },
      {
        slug: "ronny-chieng",
        name: "Ronny Chieng",
        title: "Actor and Comedian",
        bio: "Ronny Chieng is a Malaysian actor and comedian better known for his reports in Trevor Noah's The Daily Show. Previously, he has appeared in international blockbusters such as Crazy Rich Asians and Godzilla vs. Kong. In 2019, Ronny starred in his very own Netflix stand up special titled \"Asian Comedian Destroys America!\"",
      },
    ],
  },
];

const INITIAL_EXPANDED: Record<string, boolean> = Object.fromEntries(
  SPEAKERS_BY_YEAR.map((g) => [g.year, true]),
);

function VideoLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
    >
      {label}
    </a>
  );
}

function SpeakerWithPhoto({ speaker }: { speaker: Speaker }) {
  const image = SPEAKER_IMAGES[speaker.slug];
  return (
    <div className="mb-8 sm:relative sm:pl-56 sm:min-h-48">
      <div className="relative sm:absolute sm:left-0 sm:top-0 w-full sm:w-48 h-48 mb-4 sm:mb-0 rounded overflow-hidden bg-zinc-100 dark:bg-zinc-900">
        <Image
          src={image}
          alt={`${speaker.name} speaking at Stanford University from Stanford Speakers Bureau (SSB)`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 192px"
        />
      </div>
      <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
        {speaker.name}
      </h3>
      {speaker.title && (
        <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">
          {speaker.title}
        </p>
      )}
      <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
        {speaker.bio}
      </p>
      {speaker.videoUrl && speaker.videoLabel && (
        <VideoLink href={speaker.videoUrl} label={speaker.videoLabel} />
      )}
    </div>
  );
}

function SpeakerTextOnly({ speaker }: { speaker: Speaker }) {
  return (
    <div className="mb-8 relative pl-5 sm:pl-6 border-l-2 border-[#A80D0C]/70">
      <h3 className="text-xl sm:text-2xl font-semibold font-serif text-black dark:text-white mb-0">
        {speaker.name}
      </h3>
      {speaker.title && (
        <p className="text-base sm:text-lg font-normal text-zinc-600 dark:text-zinc-400 mb-2">
          {speaker.title}
        </p>
      )}
      <p className="text-base text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
        {speaker.bio}
      </p>
      {speaker.videoUrl && speaker.videoLabel && (
        <VideoLink href={speaker.videoUrl} label={speaker.videoLabel} />
      )}
    </div>
  );
}

function SpeakerRow({ speaker }: { speaker: Speaker }) {
  const hasPhoto = Boolean(SPEAKER_IMAGES[speaker.slug]);
  return hasPhoto ? (
    <SpeakerWithPhoto speaker={speaker} />
  ) : (
    <SpeakerTextOnly speaker={speaker} />
  );
}

function YearSection({
  group,
  expanded,
  onToggle,
}: {
  group: YearGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-12">
      <h2
        className="text-2xl sm:text-3xl font-bold font-serif text-black dark:text-white mb-6 cursor-pointer flex items-center gap-2 sm:gap-3 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        onClick={onToggle}
      >
        <motion.span
          className="text-xl sm:text-2xl inline-block w-5 sm:w-6"
          initial={{ rotate: expanded ? 0 : -90 }}
          animate={{ rotate: expanded ? 0 : -90 }}
          transition={{ duration: 0.3 }}
        >
          ▼
        </motion.span>
        {group.year}
      </h2>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            {group.speakers.map((speaker) => (
              <SpeakerRow key={speaker.slug} speaker={speaker} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PastSpeakersClient() {
  const [expandedYears, setExpandedYears] =
    useState<Record<string, boolean>>(INITIAL_EXPANDED);

  const toggleYear = (year: string) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full justify-center bg-white dark:bg-black pt-24">
        <section className="w-full max-w-5xl lg:py-8 py-6 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-8 font-serif">
            Past Speakers
          </h1>

          {SPEAKERS_BY_YEAR.map((group) => (
            <YearSection
              key={group.year}
              group={group}
              expanded={!!expandedYears[group.year]}
              onToggle={() => toggleYear(group.year)}
            />
          ))}
        </section>
      </main>
    </div>
  );
}
