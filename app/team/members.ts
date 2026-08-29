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
    image: "/team/chloe.png",
  },

  {
    name: "Claire Park",
    role: "Financial Officer",
    image: "/team/claire.jpeg",
  },
  {
    name: "Molly George",
    role: "Financial Officer",
    image: "/team/Molly G.jpg",
  },
  {
    name: "Molly Maloney",
    role: "Director of Community",
    image: "/team/mollym.jpeg",
  },
  {
    name: "Theia Wepaloki",
    role: "Director of Community",
    image: "/team/blank-headshot.jpeg",
  },
  {
    name: "Joshua Sulmeyer-Barley",
    role: "VP of Engagement",
    image: "/team/Josh.jpg",
  },
  {
    name: "Bennett Zytko",
    role: "Director of Partnerships",
    image: "/team/ben.jpg",
  },
  {
    name: "Carter Cochran",
    role: "Director of Coffee Chats",
    image: "/team/blank-headshot.jpeg",
  },
];

export const ADVISORS: TeamMember[] = [
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
