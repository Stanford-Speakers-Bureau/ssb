// Single source of truth for SSB speakers.
//
// Add a new speaker by pushing to SPEAKERS. Set `featuredOnHome` / `spotlightInArchive`
// to a position number (1 = first, 2 = second, …) to surface them outside of the main
// timeline/expanded archive views (those always include every entry here). Omit the
// field to exclude a speaker from that surface. Ties fall back to array order.

export type Speaker = {
  slug: string;
  name: string;
  year: string;
  title?: string;
  bio: string;
  image?: string;
  month?: string;
  location?: string;
  videoUrl?: string;
  videoLabel?: string;
  // Short pull-quote used in the home page "Who's Spoken at Stanford" carousel.
  // If omitted when featuredOnHome is set, the bio is shown (line-clamped).
  homeFeaturedQuote?: string;
  // Position (1-based) in the home page carousel. Omit to exclude.
  featuredOnHome?: number;
  featuredImage?: string;
  // Position (1-based) in the archive's spotlight row. Omit to exclude.
  spotlightInArchive?: number;
  spotlightImage?: string;
};

export const SPEAKERS: Speaker[] = [
  // 2026
  {
    slug: "rachel-platten",
    name: "Rachel Platten",
    year: "2026",
    month: "May",
    location: "Meyer Green",
    title: "Singer-songwriter",
    bio: "Rachel Platten is an American singer-songwriter best known for her hit song 'Fight Song.' She has released two studio albums, 'Wildfire' (2015) and 'Wildfire: Extended Play' (2017), and has toured extensively across the United States and internationally. Platten is also known for her advocacy work, including her support for the LGBTQ+ community and her commitment to mental health awareness.",
    image: "/speakers/rachel-platten.jpeg",
  },
  {
    slug: "steve-wozniak",
    name: "Steve Wozniak",
    year: "2026",
    month: "May",
    location: "Building",
    title: "Co-founder of Apple",
    bio: 'Stephen Gary Wozniak, affectionately known as "Woz," is an American computer engineer and technology entrepreneur. Alongside Steve Jobs, he co-founded Apple Computer (now Apple Inc.) in 1976. By single-handedly designing the Apple I and Apple II, Wozniak ignited the global personal computer revolution.',
    image: "/speakers/steve-wozniak.jpg",
  },
  {
    slug: "janet-hill",
    name: "Janet Hill",
    year: "2026",
    month: "May",
    location: "Building",
    title: "Wife of Steve Wozniak",
    bio: "Janet Hill Wozniak is best known as the wife of Apple co-founder Steve Wozniak, whom she married in August 2008. Together, they co-founded the Wozniak Family Foundation in 2014 to support STEM education, alongside various philanthropic ventures",
    image: "/speakers/woz-and-wife.jpg",
  },
  {
    slug: "arden-cho",
    name: "Arden Cho",
    year: "2026",
    month: "May",
    location: "CEMEX Auditorium",
    title: "Actor",
    bio: "Arden Cho is a Korean American actress best known as Kira Yukimura on Teen Wolf and as Rumi, a K-pop idol turned demon hunter in K-Pop: Demon Hunters. Beyond her screen roles, Cho is also a singer and dedicated advocate for Asian American representation, consistently using her platform to speak out against anti-Asian hate, uplift underrepresented voices in Hollywood, and push for more inclusive storytelling in mainstream media.",
    image: "/speakers/arden-cho.jpg",
  },
  {
    slug: "malala-yousafzai",
    name: "Malala Yousafzai",
    year: "2026",
    month: "April",
    location: "Memorial Auditorium",
    title: "Nobel Peace Prize Laureate",
    bio: "Malala Yousafzai is a human rights activist and advocate for girls' education and women's rights. She is the youngest Nobel Peace Prize laureate, receiving the prize at only 17 years old. Malala is also an acclaimed author of two books, with her most recent being Finding My Way, a memoir on her experiences at Oxford University and discovering her identity.",
    image: "/speakers/malala-yousafzai.jpg",
    homeFeaturedQuote:
      "Youngest Nobel Peace Prize laureate and global advocate for girls' education and women's rights.",
    featuredOnHome: 1,
    spotlightInArchive: 1,
  },
  {
    slug: "bernie-sanders",
    name: "Bernie Sanders",
    year: "2026",
    month: "February",
    location: "Memorial Auditorium",
    title: "U.S. Senator from Vermont",
    bio: "Bernie Sanders is the longest-serving independent in congressional history, currently serving as U.S. Senator from Vermont. He previously served in the House of Representatives for 16 years. Sanders ran for the Democratic presidential nomination in 2016 and 2020, becoming one of the most prominent progressive voices in American politics. He is known for his decades-long advocacy on issues including income inequality, universal healthcare, climate change, and campaign finance reform. He served as chair of the Senate Budget Committee and has authored several books, including The Speech and Our Revolution.",
    image: "/speakers/bernie.jpg",
    videoUrl: "https://youtu.be/Wx18tNmNYbE?t=712",
    videoLabel: "Watch Livestream",
    featuredOnHome: 2,
    featuredImage: "/speakers/bernie.jpg",
    homeFeaturedQuote:
      "Longest-serving independent in congressional history and one of the most prominent progressive voices in American politics.",
    spotlightInArchive: 2,
    spotlightImage: "/speakers/bernie-stand.jpg",
  },
  {
    slug: "ro-khanna",
    name: "Ro Khanna",
    year: "2026",
    month: "February",
    location: "Memorial Auditorium",
    title: "U.S. Representative, California's 17th Congressional District",
    bio: "Ro Khanna represents California's 17th Congressional District, which encompasses the heart of Silicon Valley. A progressive Democrat, Khanna serves on the House Armed Services Committee and the House Oversight Committee, and has been a leading voice on technology policy, economic justice, and foreign policy reform. Before entering Congress, he taught economics at Stanford University and law at Santa Clara University. He is the author of Dignity in a Digital Age and Entrepreneurial Nation, and has championed initiatives to bring tech jobs to underserved communities across America.",
    image: "/speakers/khanna.jpg",
  },
  {
    slug: "hasan-minhaj",
    name: "Hasan Minhaj",
    year: "2026",
    month: "January",
    location: "Memorial Auditorium",
    title: 'Comedian, Writer, and Former Host of "The Patriot Act"',
    bio: "Hasan Minhaj is a two-time Peabody Award-Winning comedian best known for his breakout Netflix special Homecoming King and his critically acclaimed, political satire show Patriot Act With Hasan Minhaj for Netflix which won a Peabody, an Emmy, and a Television Academy Honor. His second one-hour comedy special The King's Jester premiered on Netflix in 2022. In October 2024, Hasan released his third comedy special on Netflix, titled Off With His Head. On Hasan's ongoing digital series and podcast, Hasan Minhaj Doesn't Know, he sits down with the biggest names in politics, culture, and tech with questions that are as thought provoking as they are absurd. In the debut episode, Hasan spoke with Senator Elizabeth Warren, and he's also welcomed John M. Chu, JJ Redick, Bernie Sanders, and Stacey Abrams, among many others",
    image: "/speakers/hasan-minhaj-web.jpg",
    homeFeaturedQuote:
      "Two-time Peabody Award-winning comedian, acclaimed for his Netflix specials and Patriot Act.",
    featuredOnHome: 3,
    spotlightInArchive: 3,
  },

  // 2025
  {
    slug: "mark-rober",
    name: "Mark Rober",
    year: "2025",
    month: "May",
    location: "Memorial Auditorium",
    title: "YouTube Educator, Former NASA & Apple Engineer",
    bio: "Mark Rober is an American YouTuber, engineer, and inventor. Known for his viral videos that combine science, engineering, and humor, Rober has amassed a following of over 45 million subscribers on YouTube. Before becoming a full-time content creator, he worked as an engineer for NASA's Jet Propulsion Laboratory, where he contributed to the development of the Curiosity rover, and later at Apple, where he worked on product design patents. Rober is celebrated for his creative projects and his ability to make complex scientific concepts accessible and entertaining to a broad audience.",
    image: "/speakers/mark-rober-web.jpeg",
    homeFeaturedQuote:
      "Former NASA engineer turned YouTube star with 45M+ subscribers, making science accessible to millions.",
    featuredOnHome: 5,
    spotlightInArchive: 5,
  },
  {
    slug: "jojo-siwa",
    name: "JoJo Siwa",
    year: "2025",
    month: "May",
    location: "Memorial Auditorium",
    title: "Media Icon",
    bio: "JoJo Siwa is a media icon, dancer, and singer who rose to fame through the reality show Dance Moms and her vibrant online presence. She has built a massive following across social media platforms, with over 16 million subscribers on YouTube and more than 41 million followers on TikTok. Known for her high-energy persona, signature bows, and empowering pop music, Siwa has successfully transitioned into a versatile entertainer. She has also made history as the first contestant to be paired with a same-sex partner on Dancing with the Stars.",
    image: "/speakers/jojo-siwa-web.jpg",
    homeFeaturedQuote:
      "Dancer, singer, and media icon with 41M+ TikTok followers who made history on Dancing with the Stars.",
    featuredOnHome: 4,
    spotlightInArchive: 4,
  },
  {
    slug: "peter-cuneo",
    name: "Peter Cuneo",
    year: "2025",
    location: "CEMEX Auditorium",
    title: "Former Marvel CEO",
    bio: "Peter Cuneo is an American business executive, widely recognized for his role in the turnaround of Marvel Entertainment. As CEO from 1999 to 2009, Cuneo led the company's transformation from near-bankruptcy to a highly successful entertainment powerhouse. Under his leadership, Marvel's market capitalization grew from $250 million to over $4 billion, and the company laid the foundation for the blockbuster Marvel Cinematic Universe. His business acumen and strategic vision have been credited with revitalizing the comic book giant and paving the way for its eventual acquisition by The Walt Disney Company.",
  },
  {
    slug: "mikey-day",
    name: "Mikey Day",
    year: "2025",
    location: "CEMEX Auditorium",
    title: "SNL Cast Member",
    bio: 'Mikey Day is an American comedian, writer, and actor, best known for his work as a cast member on Saturday Night Live (SNL). He joined the show as a writer in 2013 and became a featured player in 2016. Day is known for his versatile impressions and memorable original characters, including his recurring roles as a game show host and a character in the "Haunted Elevator" sketches with Tom Hanks. Before SNL, he was a writer and performer on shows like Maya & Marty and Wild \'N Out.',
  },

  // 2024
  {
    slug: "alan-lightman",
    name: "Alan Lightman",
    year: "2024",
    title: "Physicist & Author",
    bio: "Alan Lightman is an American physicist, writer, and social entrepreneur. He has served on the faculties of Harvard University and Massachusetts Institute of Technology (MIT) and is currently a professor of the practice of the humanities at the Massachusetts Institute of Technology (MIT). Lightman is the author of the international bestseller Einstein's Dreams, and his novel The Diagnosis was a finalist for the National Book Award. He is also the founder of Harpswell, a nonprofit organization whose mission is to advance a new generation of women leaders in Southeast Asia. Lightman hosts the public television series Searching: Our Quest for Meaning in the Age of Science.",
  },
  {
    slug: "richard-sherman",
    name: "Richard Sherman '10",
    year: "2024",
    title: "NFL Player",
    bio: 'Richard Sherman is a former NFL cornerback, widely recognized for his personality and exceptional skill on the field. Sherman gained prominence as a key player for the Seattle Seahawks during their Super Bowl-winning season in 2013, becoming a cornerstone of the "Legion of Boom" defense. Known for his intelligence and leadership, he was a fifth-round pick from Stanford who defied the odds to become one of the top players in the league. After retiring from football, Sherman transitioned into broadcasting, becoming an analyst for Amazon\'s Thursday Night Football in 2022. He is also an advocate for social justice and education reform.',
  },
  {
    slug: "john-green",
    name: "John Green",
    year: "2024",
    location: "CEMEX Auditorium",
    title: "Author & YouTube Educator",
    bio: "John Green is a best-selling author and YouTuber, known for his impactful novels and educational YouTube content. His breakout novel, The Fault in Our Stars (2012), became a global sensation, spending time on the New York Times Best Seller list, landing in the top 100 best-selling books ever, and later being adapted into a successful film. Alongside his brother Hank, John co-created the popular YouTube channel Crash Course, providing free educational content to millions of students.",
    image: "/speakers/john-green-web.jpg",
    homeFeaturedQuote:
      "Best-selling author of The Fault in Our Stars and co-creator of Crash Course with 15M+ subscribers.",
    featuredOnHome: 6,
    spotlightInArchive: 6,
  },
  {
    slug: "phil-hellmuth",
    name: "Phil Hellmuth",
    year: "2024",
    title: "17x World Poker Champion",
    bio: 'Phil Hellmuth is known by many as the best tournament poker player ever. He has captivated fans with his amazing poker skill, and his antics on and off the table. Hellmuth is celebrated by many for his "Poker Brat" personality, with trash talk and flash a key part of his persona. He has won over $30,000,000 in tournament poker, and is a Palo Alto resident. After his talk, Mr. Hellmuth played a game of poker with students in SSB and the Stanford Poker Club.',
  },

  // 2023
  {
    slug: "roxane-gay",
    name: "Roxane Gay",
    year: "2023",
    title: "Author",
    bio: "Roxane Gay is an acclaimed author known for her insightful and thought-provoking works that explore themes of feminism, race, and identity. She has authored several influential books, including Bad Feminist, a collection of essays that has resonated with a wide audience. Gay is celebrated for her candid writing style and her ability to address complex social issues with nuance and humor. In addition to her essays, she has written fiction, including the novel An Untamed State, opinion pieces for the New York Times, served as editor of Gay Mag, and founded Tiny Hardcore Press. Her work often challenges cultural norms and advocates for social justice.",
  },
  {
    slug: "stuart-weitzman",
    name: "Stuart Weitzman",
    year: "2023",
    title: "Designer",
    bio: 'Stuart Weitzman is a major shoe designer, who is best known for the "million dollar" shoes he has made for Oscar nominees and red carpet appearances. He has designed shoes for Beyonce, Taylor Swift, and other top talent. Weitzman is well-known for the unique materials in his shoes, including cork, vinyl, lucite, wallpaper, and 24-karat gold. His shoes are sold in over 70 countries. Mr. Weitzman also collects stamps, and is known for his purchase of the British Guiana 1c magenta, or the world\'s most famous stamp.',
  },
  {
    slug: "kal-penn",
    name: "Kal Penn",
    year: "2023",
    title: "Actor",
    bio: "Kal Penn has achieved noteworthy success in both the entertainment industry and public service. Kal Penn has played major roles in Van Wilder, the Harold & Kumar series, and been a guest host on The Daily Show. He has also been active in public service, serving as the Associate Director of the White House Office of Public Engagement and Intergovernmental Affairs under President Obama, focusing on issues related to youth, arts, and Asian American and Pacific Islander communities. Additionally, Penn worked as a visiting lecturer in Asian American Studies at the University of Pennsylvania.",
  },
  {
    slug: "sima-taparia",
    name: "Sima Taparia",
    year: "2023",
    title: "Netflix Personality",
    bio: "Sima Taparia, known by fans as Sima Aunty, is a matchmaker from Mumbai. In 2017, the documentary 'A Suitable Girl' was released on Netflix featuring Sima Aunty finding a match for her daughter and two others winning the Best New Documentary Filmmaker award at the Tribeca Film Festival. In July 2020, the reality show \"Indian Matchmaking\" was released on Netflix, showing the process of Sima Aunty finding matches for her clients. The show was nominated for the Outstanding Unstructured Reality Program Emmy in 2021.",
  },
  {
    slug: "preacher-lawson",
    name: "Preacher Lawson",
    year: "2023",
    title: "Stand-Up Comedian",
    bio: 'Preacher Lawson is an American comedian and actor from Portland, Oregon. He gained national recognition as a finalist on the 12th season of "America\'s Got Talent." Lawson has since performed on numerous TV shows, including "The Late Late Show with James Corden," "Last Call with Carson Daly," and "Conan." He has also acted in movies and TV shows, including a recurring role on the sitcom "Connecting...". Known for his high-energy, observational comedy, Lawson has become a rising star in the world of comedy, captivating audiences with his dynamic stage presence and sharp humor.',
  },

  // 2022
  {
    slug: "jennette-mccurdy",
    name: "Jennette McCurdy",
    year: "2022",
    title: "Author and Actress",
    bio: 'New York Times Bestselling Author Jennette McCurdy has been showcasing her multitude of talents for over 20 years, with more than 100 credits under her belt between film and TV. Most recently, Jennette has chronicled the unflinching details surrounding her life and rise to fame in her newly released memoir "I\'m Glad My Mom Died", which stayed at #1 on the NYT bestseller list for eight consecutive weeks. In addition to her impressive acting resume, Jennette is an accomplished creator, and has been honored as part of the 2022 TIME100 Next list.',
  },
  {
    slug: "margaret-atwood",
    name: "Margaret Atwood",
    year: "2022",
    title: "Writer",
    bio: "Margaret Atwood, whose work has been published in more than forty-five countries, is the author of more than fifty books of fiction, poetry, critical essays, and graphic novels. Her latest novel, The Testaments, is a co-winner of the 2019 Booker Prize. It is the long-awaited sequel to The Handmaid's Tale, now an award-winning TV series. Her other works of fiction include Cat's Eye, finalist for the 1989 Booker Prize; Alias Grace, which won the Giller Prize in Canada and the Premio Mondello in Italy; The Blind Assassin, winner of the 2000 Booker Prize; The MaddAddam Trilogy; and Hag-Seed. She is the recipient of numerous awards, including the Peace Prize of the German Book Trade, the Franz Kafka International Literary Prize, the PEN Center USA Lifetime Achievement Award, and the Los Angeles Times Innovator's Award. She lives in Toronto.",
  },
  {
    slug: "jimmy-o-yang",
    name: "Jimmy O. Yang",
    year: "2022",
    title: "Stand-up Comedian",
    bio: 'Jimmy O. Yang is a Hong Kong-born American actor, stand-up comedian, and writer. He is best known for his portrayal of Jian-Yang on the HBO series "Silicon Valley." Additionally, Yang has appeared in movies such as "Crazy Rich Asians," "The Internship," and "Fantasy Island." He is also a published author, having written the memoir "How to American: An Immigrant\'s Guide to Disappointing Your Parents." With his multifaceted talent and diverse range of roles, Jimmy O. Yang has established himself as a prominent figure in the entertainment industry.',
  },
  {
    slug: "bill-nye",
    name: "Bill Nye",
    year: "2022",
    month: "May",
    location: "CEMEX Auditorium",
    title: "Scientist",
    bio: "Bill Nye, scientist, engineer, comedian, author and inventor, is a man with a mission: to help foster a scientifically literate society and to help people everywhere understand and appreciate the science that makes our world work. Perhaps best known as Bill Nye the Science Guy, Bill's wit and enthusiasm garnered 18 Emmy awards. Bill is also an author and frequent speaker on topics of global importance including climate change, evolution, population, space exploration, and STEM education. He is a steadfast champion of the unwavering value of critical thinking, science, and reason. Most recently, Nye was the subject of the documentary film Bill Nye: Science Guy. This behind the scenes portrait of Nye follows him as he takes off his Science Guy lab coat and takes on those who would deny climate change, evolution, and a science-based worldview.",
  },
  {
    slug: "sadiq-khan",
    name: "Sadiq Khan",
    year: "2022",
    month: "May",
    location: "CEMEX Auditorium",
    title: "Mayor of London",
    bio: "Mr. Sadiq Khan was elected Mayor of London in 2016. The son of Pakistani immigrants, a bus driver and a seamstress, Mayor Khan is the first Muslim to be elected to serve as the mayor of a major Western city and has the biggest personal mandate of any politician in the UK. In 2018, he was named on TIME's list of 100 most influential people. Since his re-election last year, Mayor Khan has made addressing climate change one of his top priorities and has also focused on building affordable housing, running the city's world-class transport network, and reforming the police. Khan is strongly linked to the social democratic wing of the British Labour Party.",
  },
  {
    slug: "louise-gluck",
    name: "Louise Glück",
    year: "2022",
    title: "Poet",
    bio: "Louise Glück is an acclaimed poet, having won the 2020 Nobel Prize in Literature, and authored 12 books of poetry as well as winning the Pulitzer Prize, National Book Award, and National Humanities Medal. She has held roles as an English professor at Yale and a visiting professor of creative writing at Stanford.",
  },

  // 2021
  {
    slug: "dolores-huerta",
    name: "Dolores Huerta",
    year: "2021",
    bio: "Dolores Huerta is a civil rights activist and community organizer. She has worked for labor rights and social justice for over 50 years. In 1962, she and Cesar Chavez founded the United Farm Workers union. She served as Vice President and played a critical role in many of the union's accomplishments for four decades. In 2002, she received the Puffin/Nation $100,000 prize for Creative Citizenship which she used to establish the Dolores Huerta Foundation (DHF). DHF is connecting groundbreaking community-based organizing to state and national movements to register and educate voters; advocate for education reform; bring about infrastructure improvements in low-income communities; advocate for greater equality for the LGBT community; and create strong leadership development. Dolores has received numerous awards: among them The Eleanor Roosevelt Humans Rights Award from President Clinton in 1998. In 2012 President Obama bestowed Dolores with The Presidential Medal of Freedom, the highest civilian honor in the United States.",
  },
  {
    slug: "jaboukie-young-white",
    name: "Jaboukie Young-White",
    year: "2021",
    month: "November",
    location: "CEMEX Auditorium",
    title: "Comedian, Writer, and Filmmaker",
    bio: 'Jaboukie Young-White is a comedian and filmmaker from Chicago who was previously a correspondent on "The Daily Show with Trevor Noah." He has performed stand up twice on "The Tonight Show Starring Jimmy Fallon" and recently debuted his half-hour for "Comedy Central Stand-Up Presents." Previously, Jaboukie was a staff writer on Netflix\'s " American Vandal" and the animated series "Big Mouth."',
  },
  {
    slug: "sebastian-stan",
    name: "Sebastian Stan",
    year: "2021",
    title: "Actor and Activist",
    bio: "Sebastian Stan is an acclaimed Romanian-American actor and activist. His career started in shows such as Law and Order, Gossip Girl, and Once upon a Time. Most recently, Sebastian has become widely recognized for his interpretation of Bucky Barnes in the Marvel Cinematic Universe. Outside the spotlight, he also supports NGOs around the world to help improve the quality of life for children.",
  },
  {
    slug: "jonathan-van-ness",
    name: "Jonathan Van Ness",
    year: "2021",
    title: "Television Personality",
    bio: 'Jonathan Van Ness is an Emmy-nominated television personality, podcaster, and hairstylist to the stars. They can be seen starring on Netflix\'s Emmy Award-winning reboot series "Queer Eye," where they shine as the show\'s groomer, hair stylist, and self-care advocate. In addition to "Queer Eye," JVN starred on the Emmy-nominated series "Gay of Thrones," (Funny or Die) a witty social commentary series recapping HBO\'s "Game of Thrones." After a worldwide comedy tour in 2019, they published "Over the Top" their first book and memoir.',
  },
  {
    slug: "noam-chomsky",
    name: "Noam Chomsky",
    year: "2021",
    title: "Linguist, Cognitive Scientist, Political Thinker",
    bio: "Professor Noam Chomsky is a distinguished linguist and political thinker. Currently, he serves as Emeritus Professor at MIT, where he worked extensively to create modern linguistics over the last few decades. Outside of academia, Professor Chomsky has become a prominent philosopher and political commentator, providing a critical eye to power structures around the world. Throughout his career, he has written dozens of books and articles on topics ranging from the structure of language to political analysis.",
  },
  {
    slug: "dominique-morgan",
    name: "Dominique Morgan",
    year: "2021",
    title: "Activist, Artist, Speaker",
    bio: "Dominique Morgan is an award-winning artist, activist, and TEDx speaker. As the Executive Director of Black & Pink National, the largest prison abolitionist organization in the United States, she works daily to dismantle the systems that perpetuate violence on LGBTQ/GNC people and individuals living with HIV/AIDS. Partnering her lived experience of being impacted by mass incarceration with a decade of change-making artistry, advocacy, and background in public health, she continues to work to dismantle the prison industrial complex and mitigate its impact on our communities. Dominique is a 2020 Ten Outstanding Young Americans Award recipient, NAACP Freedom Fighter Award recipient, and 2020 JM Kaplan Innovation Prize.",
  },
  {
    slug: "ronny-chieng",
    name: "Ronny Chieng",
    year: "2021",
    title: "Actor and Comedian",
    bio: 'Ronny Chieng is a Malaysian actor and comedian better known for his reports in Trevor Noah\'s The Daily Show. Previously, he has appeared in international blockbusters such as Crazy Rich Asians and Godzilla vs. Kong. In 2019, Ronny starred in his very own Netflix stand up special titled "Asian Comedian Destroys America!"',
  },

  // 2020
  {
    slug: "grant-sanderson",
    name: "Grant Sanderson",
    year: "2020",
    month: "January",
    location: "CEMEX Auditorium",
    title: "YouTuber and Educator",
    bio: "Grant Sanderson is a renowned mathematics educator and creator of the popular YouTube channel 3Blue1Brown, which boasts over 8 million subscribers. He is best known for using high-quality animated visualizations (created with his own open-source library, Manim) to make complex topics in mathematics, physics, and computer science intuitive, visual, and accessible.",
  },

  // 2019
  {
    slug: "david-taylor",
    name: "David Taylor",
    year: "2019",
    month: "November",
    location: "CEMEX Auditorium",
    title: "",
    bio: "",
  },
  {
    slug: "rose-mcgowan",
    name: "Rose McGowan",
    year: "2019",
    month: "May",
    location: "Bishop Auditorium",
    title: "Actress and Activist",
    bio: 'Rose McGowan first rose to fame as a 1990s "it-girl" with standout roles in the cult classic The Doom Generation and the blockbuster horror film Scream. She achieved widespread commercial success in the 2000s by starring as Paige Matthews in the hit series Charmed and later in the high-concept action film Grindhouse. However, her career path shifted dramatically in 2017 when she became a primary whistleblower against Harvey Weinstein. This brave stance helped ignite the global #MeToo movement and led Time magazine to name her a "Silence Breaker" for their Person of the Year. Since then, she has transitioned from acting to full-time activism and writing, chronicling her journey in the memoir Brave. Today, she remains a vocal advocate for systemic change, balancing her past as a Hollywood star with her current life as an influential social critic.',
  },
  {
    slug: "ban-ki-moon",
    name: "Ban Ki-moon",
    year: "2019",
    month: "April",
    location: "Hauck Auditorium",
    title: "Former Secretary-General of the United Nations",
    bio: "Ban Ki-moon (반기문) is a South Korean politician and diplomat who served as the eighth Secretary-General of the United Nations (and the first Asian Secretary-General) between 2007 and 2016. Prior to his appointment as secretary-general, Ban was the South Korean minister of foreign affairs and trade between 2004 and 2006. Ban was initially considered to be a long shot for the office of Secretary-General of the United Nations; he began to campaign for the office in February 2006. As the foreign minister of South Korea, he was able to travel to all the countries on the United Nations Security Council, a manoeuvre that subsequently turned him into the campaign's front-runner.",
    image: "/speakers/ba-ki-moon.jpg",
  },
  {
    slug: "ken-jeong",
    name: "Ken Jeong",
    year: "2019",
    month: "April",
    location: "Dinkelspiel Auditorium",
    title: "Actor and Comedian",
    bio: "Ken Jeong is an American stand-up comedian and actor. He rose to prominence for playing Leslie Chow in The Hangover film series (2009–2013) and Ben Chang in the NBC sitcom Community (2009–2015). He created, wrote and produced the ABC sitcom Dr. Ken (2015–2017), in which he portrays the titular character, and he has appeared in the films Knocked Up (2007), Role Models (2008), Furry Vengeance (2010), The Duff (2015), Ride Along 2 (2016), Crazy Rich Asians (2018), Scoob! (2020), Tom & Jerry (2021), and KPop Demon Hunters (2025). He is a licensed physician in California but has since stopped practicing in favor of his acting career. He appears as a panelist on the American version of the singing competition show The Masked Singer and appeared on the first series of the British version. He also serves as the host of I Can See Your Voice.",
    image: "/speakers/ken-jeong.jpg",
  },
  {
    slug: "andre-aciman",
    name: "André Aciman",
    year: "2019",
    month: "March",
    location: "Bishop Auditorium",
    title: "Author and Novelist",
    bio: "André Aciman is an Italian-American author and current professor at the City University of New York. He is an expert in the history of literary theory and the works of Marcel Proust, where he has taught French literature and creative writing at Princeton, NYU, and Bard College. He is known for his novel Call Me by Your Name. The novel won a Lambda Literary Award and was made into an Academy Award-winning film. Aciman also received a Whiting Award for his memoir, Out of Egypt. In interviews, he has said that his novel Eight White Nights is his best work.",
    image: "/speakers/andre-aciman.JPG",
  },
  {
    slug: "glen-keane",
    name: "Glen Keane",
    year: "2019",
    month: "February",
    location: "CEMEX Auditorium",
    title: "Animator and Director",
    bio: "Glen Keane is an American animator and director. He is best known for his work on Disney films such as The Little Mermaid, Aladdin, and Tangled. He is also known for his work on the television series The Simpsons and Futurama. He is a two-time Academy Award winner for Best Animated Feature for his work on The Little Mermaid and Tangled.",
    image: "/speakers/glen-keane.JPG",
  },
  {
    slug: "jennifer-lopez",
    name: "Jennifer Lopez",
    year: "2019",
    month: "January",
    location: "Memorial Auditorium",
    title: "Actor and Singer",
    bio: 'Jennifer Lynn Lopez (born July 24, 1969), nicknamed "J. Lo," is a globally influential American singer, actress, dancer, and businesswoman who broke barriers as one of the highest-paid Latina actresses in Hollywood history. Rising from a "Fly Girl" dancer on In Living Color to stardom, she earned critical acclaim for her role in Selena (1997) and cemented her pop icon status with hits like "If You Had My Love" and "Waiting for Tonight". She achieved the rare feat of having a number-one movie and album simultaneously in 2001 with The Wedding Planner and her album J. Lo. Known for her versatility, she has starred in hit romantic comedies and films such as Monster-in-Law, Hustlers (2019), and The Mother (2023), while delivering Billboard hits including "Jenny from the Block" and "On the Floor".',
    image: "/speakers/j-lo.jpeg",
  },
  {
    slug: "alex-rodriguez",
    name: "Alex Rodriguez",
    year: "2019",
    month: "January",
    location: "Memorial Auditorium",
    title: "Former Major League Baseball Player",
    bio: "Alex Rodriguez, nicknamed \"A-Rod\" is an American former professional baseball shortstop and third baseman and current businessman. Rodriguez played 22 seasons in Major League Baseball (MLB) for the Seattle Mariners (1994–2000), Texas Rangers (2001–2003), and New York Yankees (2004–2013, 2015–2016). Rodriguez is the chairman and chief executive officer of A-Rod Corp as well as the chairman of Presidente beer. He owns a controlling interest in the National Basketball Association's Minnesota Timberwolves with Marc Lore. Rodriguez began his professional baseball career as one of the sport's most highly touted prospects and is considered one of the greatest baseball players of all time.",
    image: "/speakers/a-rod.jpeg",
  },

  // 2018
  {
    slug: "scott-dikkers",
    name: "Scott Dikkers",
    year: "2018",
    month: "October",
    location: "CEMEX Auditorium",
    title: "Founder of The Onion",
    bio: "Scott Dikkers is the founder of The Onion, a satirical newspaper that has been published since 1988. He was the publication's longest-serving editor-in-chief, holding the position from 1988–1999 and again from 2005–2008. He also served as the satire newspaper's General Manager and Vice President of Creative Development from 2012–2014.",
    image: "/speakers/scott-dikkers.jpeg",
  },
  {
    slug: "hasan-minhaj-2018",
    name: "Hasan Minhaj",
    year: "2018",
    month: "April",
    location: "Dinkelspiel Auditorium",
    title: 'Comedian, Writer, and Former Host of "The Patriot Act"',
    bio: "Hasan Minhaj is a two-time Peabody Award-Winning comedian best known for his breakout Netflix special Homecoming King and his critically acclaimed, political satire show Patriot Act With Hasan Minhaj for Netflix which won a Peabody, an Emmy, and a Television Academy Honor. His second one-hour comedy special The King's Jester premiered on Netflix in 2022. In October 2024, Hasan released his third comedy special on Netflix, titled Off With His Head. On Hasan's ongoing digital series and podcast, Hasan Minhaj Doesn't Know, he sits down with the biggest names in politics, culture, and tech with questions that are as thought provoking as they are absurd. In the debut episode, Hasan spoke with Senator Elizabeth Warren, and he's also welcomed John M. Chu, JJ Redick, Bernie Sanders, and Stacey Abrams, among many others",
    image: "/speakers/hasan-minhaj-old.JPG",
  },
  {
    slug: "brandon-stanton",
    name: "Brandon Stanton",
    year: "2018",
    month: "April",
    location: "CEMEX Auditorium",
    title: "Founder of Humans of New York",
    bio: 'Brandon Stanton (born March 1, 1984) is an American author, photographer, and blogger. He is the author of Humans of New York (HONY), a photoblog and book. He was named to Time magazine\'s "30 Under 30 People Changing the World" list. Since 2010, Stanton has taken hundreds of portraits of people living and working primarily in New York City, accompanied by bits of conversations about their lives. He has also traveled outside of the United States, capturing people and their lives in more than 20 countries, including Iran, Iraq, Uganda, Democratic Republic of the Congo, Ukraine, Vietnam, and Mexico.',
    image: "/speakers/brandon-stanton.JPG",
  },
  {
    slug: "sal-khan",
    name: "Sal Khan",
    year: "2018",
    month: "January",
    location: "CEMEX Auditorium",
    title: "Founder of Khan Academy",
    bio: "Sal Khan is the founder of Khan Academy, a non-profit organization that provides free online education to anyone, anywhere. He is also the author of the book The One World Schoolhouse: Education Reimagined, which explores the future of education and how it can be used to transform lives and communities.",
    image: "/speakers/sal-khan.JPG",
  },

  // 2017
  {
    slug: "daveed-diggs",
    name: "Daveed Diggs",
    year: "2017",
    month: "May",
    location: "Dinkelspiel Auditorium",
    title: "Actor, Writer, and Producer",
    bio: "Daveed Diggs is an acclaimed American actor, rapper, and singer-songwriter best known for originating the dual roles of Marquis de Lafayette and Thomas Jefferson in Broadway's Hamilton (2015), winning a 2016 Tony Award and Grammy. A vocalist for experimental hip hop group Clipping, his career spans film, television, and music, including starring in Snowpiercer, Blindspotting, and Disney's live-action The Little Mermaid.",
    image: "/speakers/daveed-diggs.JPG",
  },
  {
    slug: "kamau-bell",
    name: "W. Kamau Bell",
    year: "2017",
    month: "February",
    location: "CEMEX Auditorium",
    title: "Comedian, Writer, and Actor",
    bio: "Walter Kamau Bell is an American stand-up comic and television host. He hosted the CNN series United Shades of America from 2016 to 2022, and hosted FXX television series Totally Biased with W. Kamau Bell from 2012 to 2013. He is the host of the live radio show and podcast Kamau Right Now on KALW, and also co-hosts the podcasts Denzel Washington Is the Greatest Actor of All Time Period with comedian Kevin Avery and Politically Re-Active with Hari Kondabolu. In 2022, Bell directed and produced the documentary miniseries We Need to Talk About Cosby.",
  },
  {
    slug: "anthony-doerr",
    name: "Anthony Doerr",
    year: "2017",
    month: "February",
    location: "Cemex Auditorium",
    title: "The Beautiful Art of Failure",
    bio: "Anthony Doerr is an American author and journalist. He is the author of the novel The Beautiful Art of Failure, which was published in 2017. The book is a memoir of his life and career, and explores the themes of failure and success.",
  },

  // 2016

  {
    slug: "billy-collins",
    name: "Billy Collins",
    year: "2016",
    month: "April",
    location: "Dinkelspiel Auditorium",
    title: "Former Poet Laureate of the United States",
    bio: "William James Collins is an American poet who served as the Poet Laureate of the United States from 2001 to 2003. He was a Distinguished Professor at Lehman College of the City University of New York, retiring in 2016. Collins was recognized as a Literary Lion of the New York Public Library (1992) and selected as the New York State Poet for 2004 through 2006. In 2016, Collins was inducted into the American Academy of Arts and Letters. As of 2020, he is a teacher in the MFA program at Stony Brook Southampton.",
  },
  {
    slug: "aimee-mann",
    name: "Aimee Mann",
    year: "2016",
    month: "April",
    location: "Dinkelspiel Auditorium",
    title: "Singer-Songwriter",
    bio: "Aimee Mann is a highly acclaimed American singer-songwriter and bassist known for her sharp, literate lyrics and a career spanning over four decades. She first rose to fame in the 1980s as the frontwoman of the New Wave band 'Til Tuesday, who had a massive hit with 'Voices Carry'. Since going solo in 1993, she has built a reputation as one of the best living songwriters, earning multiple Grammy Awards and an Oscar nomination.",
  },
  {
    slug: "tony-schwartz",
    name: "Tony Schwartz",
    year: "2016",
    month: "November",
    location: "Dinkelspiel Auditorium",
    title: "Author and Journalist",
    bio: "Tony Schwartz is a renowned journalist, author, and CEO of The Energy Project, recognized for his work on sustainable high performance and workplace culture. A former reporter for The New York Times and writer for Esquire and New York Magazine, he is best known as the ghostwriter of Donald Trump’s The Art of the Deal (1987) and co-author of the bestseller The Power of Full Engagement.",
  },
];

// Derived views — everything below is computed from SPEAKERS above.

export const FEATURED_HOME_SPEAKERS: Speaker[] = SPEAKERS.filter(
  (s) => typeof s.featuredOnHome === "number",
).sort((a, b) => (a.featuredOnHome ?? 0) - (b.featuredOnHome ?? 0));

export const SPOTLIGHT_SPEAKERS: Speaker[] = SPEAKERS.filter(
  (s) => typeof s.spotlightInArchive === "number",
).sort((a, b) => (a.spotlightInArchive ?? 0) - (b.spotlightInArchive ?? 0));

export const SPEAKER_IMAGES: Record<string, string> = Object.fromEntries(
  SPEAKERS.filter((s) => s.image).map((s) => [s.slug, s.image as string]),
);

export const YEARS: string[] = Array.from(
  new Set(SPEAKERS.map((s) => s.year)),
).sort((a, b) => Number(b) - Number(a));

export const SPEAKERS_BY_YEAR: { year: string; speakers: Speaker[] }[] =
  YEARS.map((year) => ({
    year,
    speakers: SPEAKERS.filter((s) => s.year === year),
  }));
