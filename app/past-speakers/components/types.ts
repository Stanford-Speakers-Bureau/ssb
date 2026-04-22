export type Speaker = {
  slug: string;
  name: string;
  title?: string;
  bio: string;
  videoUrl?: string;
  videoLabel?: string;
  month?: string;
  location?: string;
};

export type FlatSpeaker = Speaker & { year: string };

export type ViewMode = "timeline" | "expanded";
