import type { Caption } from "@remotion/captions";
import type { CurriculumVideo } from "./curriculum";
import { getCourseCurriculum } from "./course-curriculum";
import { getSupabaseAdmin } from "./supabase-admin";

export type ConceptPatch = {
  captions?: Caption[] | null;
  video_r2_key?: string | null;
};

async function getLesson(courseId: string, lessonId: number): Promise<CurriculumVideo | null> {
  const curriculum = await getCourseCurriculum(courseId);
  return curriculum?.videos?.find(v => v.id === lessonId) ?? null;
}

function lessonMetadata(lesson: CurriculumVideo, videoR2Key?: string | null) {
  return {
    lesson_id: lesson.id,
    title: lesson.title,
    date: lesson.date,
    era: lesson.era,
    prompt: lesson.prompt,
    narration: lesson.narration,
    question: lesson.question,
    video_r2_key: videoR2Key ?? lesson.video_r2_key ?? null,
  };
}

export async function upsertConceptForLesson(
  courseId: string,
  lessonId: number,
  patch: ConceptPatch,
) {
  const lesson = await getLesson(courseId, lessonId);
  if (!lesson) throw new Error(`Lesson ${lessonId} not found in curriculum`);

  const { client } = getSupabaseAdmin();

  const { data: existing } = await client
    .from("concepts")
    .select("id, captions, metadata")
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .is("deleted_at", null)
    .maybeSingle();

  const videoR2Key =
    patch.video_r2_key !== undefined
      ? patch.video_r2_key
      : (existing?.metadata as { video_r2_key?: string } | null)?.video_r2_key ?? lesson.video_r2_key ?? null;

  const captions =
    patch.captions !== undefined ? patch.captions : (existing?.captions as Caption[] | null) ?? null;

  const row = {
    course_id: courseId,
    lesson_id: lessonId,
    captions,
    metadata: lessonMetadata(lesson, videoR2Key),
  };

  if (existing) {
    const { error } = await client.from("concepts").update(row).eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("concepts").insert(row);
    if (error) throw new Error(error.message);
  }
}

export async function getConceptCaptionsMap(courseId: string): Promise<Map<number, Caption[]>> {
  const { client } = getSupabaseAdmin();
  const { data, error } = await client
    .from("concepts")
    .select("lesson_id, captions")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .not("lesson_id", "is", null);

  if (error) throw new Error(error.message);

  const map = new Map<number, Caption[]>();
  for (const row of data ?? []) {
    if (row.lesson_id && Array.isArray(row.captions)) {
      map.set(row.lesson_id, row.captions as Caption[]);
    }
  }
  return map;
}
