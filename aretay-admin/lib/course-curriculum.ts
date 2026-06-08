import type { Caption } from "@remotion/captions";
import type { ConceptData } from "./concepts";
import { updateConceptForLesson } from "./concepts";
import type { Curriculum, CurriculumVideo } from "./curriculum";
import { getSupabaseAdmin } from "./supabase-admin";

export async function getCourseCurriculum(courseId: string): Promise<Curriculum | null> {
  const { client } = getSupabaseAdmin();
  const { data, error } = await client
    .from("courses")
    .select("curriculum")
    .eq("id", courseId)
    .is("deleted_at", null)
    .single();

  if (error) throw new Error(error.message);
  return (data?.curriculum as Curriculum | null) ?? null;
}

export type EnrichedCurriculumVideo = CurriculumVideo & {
  video_url: string | null;
  captions: Caption[] | null;
};

export async function enrichCurriculumVideos(
  courseId: string,
  videos: CurriculumVideo[],
  conceptsMap: Map<number, ConceptData>,
  resolveUrl: (key: string) => Promise<string>,
  discoverKey: (lessonId: number) => Promise<string | null>,
): Promise<EnrichedCurriculumVideo[]> {
  return Promise.all(
    videos.map(async lesson => {
      const concept = conceptsMap.get(lesson.id);
      let key = concept?.video_r2_key ?? null;

      if (!key) {
        const discovered = await discoverKey(lesson.id);
        if (discovered) {
          key = discovered;
          await updateConceptForLesson(courseId, lesson.id, { video_r2_key: discovered });
        }
      }

      return {
        ...lesson,
        video_url: key ? await resolveUrl(key) : null,
        captions: concept?.captions ?? null,
      };
    }),
  );
}
