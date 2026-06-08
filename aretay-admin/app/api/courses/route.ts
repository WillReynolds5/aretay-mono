import { NextRequest, NextResponse } from "next/server";
import { syncConceptsForCourse } from "@/lib/concepts";
import type { Curriculum } from "@/lib/curriculum";
import { sanitizeCurriculum } from "@/lib/curriculum";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const COURSE_COLUMNS =
  "id, title, description, cover_image_url, visibility, curriculum, created_at, deleted_at";

export async function GET() {
  try {
    const { client } = getSupabaseAdmin();
    const { data, error } = await client
      .from("courses")
      .select(COURSE_COLUMNS)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ courses: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load courses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { client, ownerId } = getSupabaseAdmin();
    const body = await req.json();

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Course name is required" }, { status: 400 });
    }

    const curriculum =
      body.curriculum != null
        ? sanitizeCurriculum(body.curriculum as Curriculum)
        : null;

    const visibility =
      body.visibility === "private" || body.visibility === "unlisted" || body.visibility === "public"
        ? body.visibility
        : "public";

    const { data, error } = await client
      .from("courses")
      .insert({
        owner_id: ownerId,
        title,
        description: typeof body.description === "string" ? body.description.trim() || null : null,
        cover_image_url: typeof body.cover_image_url === "string" ? body.cover_image_url.trim() || null : null,
        visibility,
        curriculum,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (curriculum) {
      await syncConceptsForCourse(data.id);
    }

    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create course";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
