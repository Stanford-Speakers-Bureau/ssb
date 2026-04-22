export type Speaker = {
  slug: string;
  name: string;
  title?: string;
  bio: string;
  videoUrl?: string;
  videoLabel?: string;
};

export type YearGroup = {
  year: string;
  speakers: Speaker[];
};

export type FlatSpeaker = Speaker & { year: string };
