import { NextRequest, NextResponse } from "next/server";
import { updateConceptForLesson } from "@/lib/concepts";
import { transcribeFromUrl } from "@/lib/whisper";

export const maxDuration = 600;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const lessonId = typeof body.lessonId === "number" ? body.lessonId : null;

  if (!videoUrl) {
    return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
  }

  try {
    const captions = await transcribeFromUrl(videoUrl);

    if (courseId && lessonId !== null) {
      await updateConceptForLesson(courseId, lessonId, { captions });
    }

    return NextResponse.json({ captions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
