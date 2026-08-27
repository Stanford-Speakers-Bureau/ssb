export type TeamMember = {
  name: string;
  role: string;
  image: string;
  email?: string;
  bio?: string;
};

export const LEADERSHIP: TeamMember[] = [
  {
    name: "Rishi Jeyamurthy",
    role: "Co-President",
    image: "/team/Rishi.jpeg",
  },
  {
    name: "Suraya Mathai-Jackson",
    role: "Co-President",
    image: "/team/suraya.jpg",
  },
];

export const DIRECTORS: TeamMember[] = [
  {
    name: "Isabelle Gainsford",
    role: "Director of Marketing",
    image: "/team/izzy.jpg",
  },
  {
    name: "Hoyoon Song",
    role: "Director of Technology",
    image: "/team/hoyoon.jpeg",
  },
  {
    name: "Chloe Loquet",
    role: "VP of Design",
    image: "/team/chloe.jpg",
  },

  {
    name: "Claire Park",
    role: "Financial Officer",
    image: "/team/claire.jpg",
  },
  {
    name: "Molly George",
    role: "Financial Officer",
    image: "/team/mollyg.jpg",
  },
  {
    name: "Molly Maloney",
    role: "Director of Community",
    image: "/team/mollym.jpg",
  },
  {
    name: "Theia Wepaloki",
    role: "Director of Community",
    image: "/team/theia.jpg",
  },
  {
    name: "Joshua Sulmeyer-Barley",
    role: "Director of VP of Engagement",
    image: "/team/Josh.jpg",
  },
  {
    name: "Bennett Zytko",
    role: "Director of Partnerships",
    image: "/team/bennett.jpg",
  },
  {
    name: "Carter Cochran",
    role: "Director of Coffee Chats",
    image: "/team/carter.jpg",
  },
];

export const ADJUNCTS: TeamMember[] = [
  {
    name: "Katie Heffernan",
    role: "Executive Advisor to the Board",
    image: "/team/katie.jpg",
  },
  {
    name: "Anish Anne",
    role: "Advisor to the Board",
    image: "/team/anish.jpg",
  },
  {
    name: "Annika Joshi",
    role: "Advisor to the Board",
    image: "/team/annika.jpg",
  },
];
