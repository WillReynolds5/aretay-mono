import type { Caption } from "@remotion/captions";
import { getCourseCurriculum } from "./course-curriculum";
import { getSupabaseAdmin } from "./supabase-admin";

export type ConceptData = {
  video_r2_key: string | null;
  captions: Caption[] | null;
};

export type ConceptPatch = {
  captions?: Caption[] | null;
  video_r2_key?: string | null;
};

export async function syncConceptsForCourse(courseId: string) {
  const curriculum = await getCourseCurriculum(courseId);
  if (!curriculum?.videos?.length) return;

  const { client } = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await client
    .from("concepts")
    .select("lesson_id")
    .eq("course_id", courseId)
    .is("deleted_at", null);

  if (fetchError) throw new Error(fetchError.message);

  const existingIds = new Set((existing ?? []).map(row => row.lesson_id));
  const toInsert = curriculum.videos
    .filter(lesson => !existingIds.has(lesson.id))
    .map(lesson => ({
      course_id: courseId,
      lesson_id: lesson.id,
      video_r2_key: null,
      captions: null,
      metadata: {},
    }));

  if (!toInsert.length) return;

  const { error } = await client.from("concepts").insert(toInsert);
  if (error) throw new Error(error.message);
}

export async function updateConceptForLesson(
  courseId: string,
  lessonId: number,
  patch: ConceptPatch,
) {
  await syncConceptsForCourse(courseId);

  const { client } = getSupabaseAdmin();
  const updates: ConceptPatch = {};

  if (patch.captions !== undefined) updates.captions = patch.captions;
  if (patch.video_r2_key !== undefined) updates.video_r2_key = patch.video_r2_key;

  const { error } = await client
    .from("concepts")
    .update(updates)
    .eq("course_id", courseId)
    .eq("lesson_id", lessonId)
    .is("deleted_at", null);

  if (error) throw new Error(error.message);
}

export async function getConceptDataMap(courseId: string): Promise<Map<number, ConceptData>> {
  const { client } = getSupabaseAdmin();
  const { data, error } = await client
    .from("concepts")
    .select("lesson_id, video_r2_key, captions")
    .eq("course_id", courseId)
    .is("deleted_at", null)
    .not("lesson_id", "is", null);

  if (error) throw new Error(error.message);

  const map = new Map<number, ConceptData>();
  for (const row of data ?? []) {
    if (row.lesson_id == null) continue;
    map.set(row.lesson_id, {
      video_r2_key: row.video_r2_key ?? null,
      captions: Array.isArray(row.captions) ? (row.captions as Caption[]) : null,
    });
  }
  return map;
}
