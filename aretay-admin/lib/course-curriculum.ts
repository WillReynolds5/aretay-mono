import type { Caption } from "@remotion/captions";
import type { Curriculum, CurriculumVideo } from "./curriculum";
import { getSupabaseAdmin } from "./supabase-admin";

export type LessonPatch = Partial<Pick<CurriculumVideo, "video_r2_key">>;

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

export async function patchLesson(courseId: string, lessonId: number, patch: LessonPatch) {
  const curriculum = await getCourseCurriculum(courseId);
  if (!curriculum?.videos?.length) {
    throw new Error("Course has no curriculum");
  }

  const videos = curriculum.videos.map(video =>
    video.id === lessonId ? { ...video, ...patch } : video,
  );

  const { client } = getSupabaseAdmin();
  const { error } = await client
    .from("courses")
    .update({ curriculum: { ...curriculum, videos } })
    .eq("id", courseId);

  if (error) throw new Error(error.message);
}

export type EnrichedCurriculumVideo = CurriculumVideo & {
  video_url: string | null;
};

export async function enrichCurriculumVideos(
  courseId: string,
  videos: CurriculumVideo[],
  resolveUrl: (key: string) => Promise<string>,
  discoverKey: (lessonId: number) => Promise<string | null>,
): Promise<EnrichedCurriculumVideo[]> {
  return Promise.all(
    videos.map(async lesson => {
      let key = lesson.video_r2_key ?? null;

      if (!key) {
        const discovered = await discoverKey(lesson.id);
        if (discovered) {
          key = discovered;
          await patchLesson(courseId, lesson.id, { video_r2_key: key });
        }
      }

      const video_url = key ? await resolveUrl(key) : null;
      return { ...lesson, video_url };
    }),
  );
}
