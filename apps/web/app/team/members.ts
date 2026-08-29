export type TeamMember = {
  name: string;
  role: string;
  image: string;
  email?: string;
  bio?: string;
};

export const LEADERSHIP: TeamMember[] = [
  {
    name: "Anish Anne",
    role: "Co-President",
    image: "/team/anish.jpg",
    email: "anishan@stanford.edu",
  },
  {
    name: "Annika Joshi",
    role: "Co-President",
    image: "/team/annika.jpg",
    email: "ajoshi17@stanford.edu",
  },
  {
    name: "Katie Heffernan",
    role: "Executive Advisor to the Board",
    image: "/team/katie.jpg",
  },
];

export const DIRECTORS: TeamMember[] = [
  {
    name: "Ajay Eisenberg",
    role: "Financial Officer",
    image: "/team/ajay.jpg",
  },
  {
    name: "Suraya Mathai-Jackson",
    role: "Director of Marketing",
    image: "/team/suraya.jpg",
  },
  {
    name: "Michael Yu",
    role: "Director of Technology",
    image: "/team/michael.jpg",
  },
  {
    name: "Rishi Jeyamurthy",
    role: "Director of Socials",
    image: "/team/rishi.jpg",
  },
  {
    name: "Andrea Mock",
    role: "Director of Coffee Chats",
    image: "/team/andrea.jpg",
    email: "amock@stanford.edu",
  },
];
