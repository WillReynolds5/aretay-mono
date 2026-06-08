import type { Caption } from "@remotion/captions";

export type CurriculumVideo = {
  id: number;
  title: string;
  date: string;
  era: string;
  prompt: string;
  narration: string;
  question: {
    text: string;
    options: [string, string, string, string];
    answer: string;
  };
  video_r2_key?: string | null;
  captions?: Caption[] | null;
};

export type Curriculum = {
  title: string;
  videos: CurriculumVideo[];
};
