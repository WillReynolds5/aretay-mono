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
};

export type Curriculum = {
  title: string;
  videos: CurriculumVideo[];
};

const PRODUCTION_FIELDS = ["captions", "video_r2_key"] as const;

export function sanitizeCurriculum(curriculum: Curriculum): Curriculum {
  return {
    title: curriculum.title,
    videos: curriculum.videos.map(video => {
      const clean = { ...video } as Record<string, unknown>;
      for (const field of PRODUCTION_FIELDS) delete clean[field];
      return clean as CurriculumVideo;
    }),
  };
}
