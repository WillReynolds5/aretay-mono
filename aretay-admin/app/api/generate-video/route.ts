import { NextRequest, NextResponse } from "next/server";
import Replicate from "replicate";
import { updateConceptForLesson } from "@/lib/concepts";
import { getVideoUrl, lessonVideoKey, uploadVideo } from "@/lib/r2";

export const maxDuration = 300;

const SEED = 99;

function resolveOutputUrl(output: unknown): string {
  if (typeof output === "string") return output;
  if (
    output &&
    typeof output === "object" &&
    "url" in output &&
    typeof (output as { url: () => URL }).url === "function"
  ) {
    return (output as { url: () => URL }).url().href;
  }
  throw new Error("Unexpected Replicate output format");
}

export async function POST(req: NextRequest) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "REPLICATE_API_TOKEN is not configured" }, { status: 500 });
  }

  const body = await req.json();
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const lessonId = typeof body.lessonId === "number" ? body.lessonId : null;

  if (!prompt) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }
  if (!courseId || lessonId === null) {
    return NextResponse.json({ error: "courseId and lessonId are required" }, { status: 400 });
  }

  const replicate = new Replicate({ auth: token });

  try {
    const output = await replicate.run("bytedance/seedance-2.0", {
      input: {
        seed: SEED,
        prompt: prompt.slice(0, 4000),
        duration: 15,
        resolution: "480p",
        aspect_ratio: "9:16",
        generate_audio: true,
      },
    });

    const replicateUrl = resolveOutputUrl(output);
    const videoRes = await fetch(replicateUrl);
    if (!videoRes.ok) {
      throw new Error("Failed to download video from Replicate");
    }

    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const r2Key = lessonVideoKey(courseId, lessonId);
    await uploadVideo(r2Key, videoBuffer);
    await updateConceptForLesson(courseId, lessonId, { video_r2_key: r2Key, captions: null });
    const url = await getVideoUrl(r2Key);

    return NextResponse.json({ url, r2Key });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
