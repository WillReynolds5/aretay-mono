import { NextRequest, NextResponse } from "next/server";
import { enrichCurriculumVideos } from "@/lib/course-curriculum";
import { getConceptCaptionsMap } from "@/lib/concepts";
import type { Curriculum } from "@/lib/curriculum";
import { getVideoUrl, lessonVideoKey, objectExists } from "@/lib/r2";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const COURSE_COLUMNS =
  "id, title, description, cover_image_url, visibility, curriculum, created_at, deleted_at";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { client } = getSupabaseAdmin();

    const { data, error } = await client
      .from("courses")
      .select(COURSE_COLUMNS)
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });

    const curriculum = data.curriculum as Curriculum | null;
    if (curriculum?.videos?.length) {
      const captionsMap = await getConceptCaptionsMap(id);
      const enriched = await enrichCurriculumVideos(
        id,
        curriculum.videos,
        key => getVideoUrl(key),
        async lessonId => {
          const key = lessonVideoKey(id, lessonId);
          return (await objectExists(key)) ? key : null;
        },
      );
      const videos = enriched.map(lesson => ({
        ...lesson,
        captions: captionsMap.get(lesson.id) ?? lesson.captions ?? null,
      }));
      data.curriculum = { ...curriculum, videos };
    }

    return NextResponse.json({ course: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { client } = getSupabaseAdmin();

    const { error } = await client
      .from("courses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
