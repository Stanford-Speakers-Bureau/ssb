export type TeamMember = {
  name: string;
  role: string;
  image: string;
  email?: string;
  bio?: string;
};

export type Team = {
  /** Stable identifier, useful for keys and anchors. */
  id: string;
  /** Display name of the team. */
  name: string;
  members: TeamMember[];
};

/** Teams in rough order of importance. Members within a team are ordered by seniority. */
export const TEAMS: Team[] = [
  {
    id: "presidency",
    name: "Presidency",
    members: [
      {
        name: "Rishi Jeyamurthy",
        role: "Co-President",
        image: "/team/rishi.jpeg",
      },
      {
        name: "Suraya Mathai-Jackson",
        role: "Co-President",
        image: "/team/suraya.jpg",
      },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    members: [
      {
        name: "Claire Park",
        role: "Financial Officer",
        image: "/team/claire.jpeg",
      },
      {
        name: "Molly George",
        role: "Financial Officer",
        image: "/team/mollyg.jpg",
      },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    members: [
      {
        name: "Isabelle Gainsford",
        role: "Director of Marketing",
        image: "/team/izzy.JPG",
      },
      {
        name: "Chloe Loquet",
        role: "VP of Design",
        image: "/team/chloe.png",
      },
      {
        name: "Joshua Sulmeyer-Barley",
        role: "VP of Engagement",
        image: "/team/Josh.jpg",
      },
    ],
  },
  {
    id: "technology",
    name: "Technology",
    members: [
      {
        name: "Hoyoon Song",
        role: "Director of Technology",
        image: "/team/hoyoon.jpeg",
      },
    ],
  },
  {
    id: "partnerships",
    name: "Partnerships",
    members: [
      {
        name: "Bennett Zytko",
        role: "Director of Partnerships",
        image: "/team/ben.JPG",
      },
    ],
  },
  {
    id: "community",
    name: "Community",
    members: [
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
    ],
  },
  {
    id: "coffee-chats",
    name: "Coffee Chats",
    members: [
      {
        name: "Carter Cochran",
        role: "Director of Coffee Chats",
        image: "/team/blank-headshot.jpeg",
      },
    ],
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
