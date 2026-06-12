import { NextRequest, NextResponse } from "next/server";
import { wavDurationSeconds } from "@/lib/audio";
import {
  addProductionCost,
  getCardProduction,
  mergeCardProduction,
  syncCardsForCourse,
  updateCardForSegment,
} from "@/lib/cards";
import { getCourseCurriculum } from "@/lib/course-curriculum";
import { flattenQuestions } from "@/lib/curriculum";
import { parseJsonResponse, runTextPrompt } from "@/lib/llm";
import {
  ALT_ANSWER_COUNT,
  buildAltAnswersPrompt,
  buildQuestionVideoPromptPrompt,
  MIN_QUESTION_VIDEO_SECONDS,
  SEEDANCE_USD_PER_VIDEO_SECOND,
  VIDEO_DURATION_SECONDS,
} from "@/lib/production";
import { fetchOutputBuffer, getReplicate, runWithMetrics } from "@/lib/replicate";
import { getVideoUrl, segmentAudioKey, segmentVideoKey, uploadObject, uploadVideo } from "@/lib/r2";
import { KOKORO_USD_PER_COMPUTE_SECOND } from "@/lib/production";

export const maxDuration = 300;

const KOKORO_MODEL =
  "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13";
const VOICE = "bm_george";
// Matches the segment narration pace (questions get ceil(audio) seconds of video anyway).
const SPEED = 1.0;
const SEEDANCE_MODEL = "bytedance/seedance-2.0";
const SEED = 99;

function parseAlternates(text: string, correctAnswer: string): string[] {
  const parsed = parseJsonResponse(text) as { alternates?: unknown };
  if (!Array.isArray(parsed.alternates)) throw new Error("LLM returned no alternates array");
  const seen = new Set<string>([correctAnswer.trim().toLowerCase()]);
  const alternates: string[] = [];
  for (const alt of parsed.alternates) {
    if (typeof alt !== "string") continue;
    const trimmed = alt.trim();
    if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    alternates.push(trimmed);
  }
  if (!alternates.length) throw new Error("LLM returned no usable alternate answers");
  return alternates.slice(0, ALT_ANSWER_COUNT);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const courseId = typeof body.courseId === "string" ? body.courseId.trim() : "";
  const segmentKey = typeof body.segmentKey === "string" ? body.segmentKey.trim() : "";
  const questionIndex = Number.isInteger(body.questionIndex) ? body.questionIndex : -1;
  const force = body.force === true;

  if (!courseId || !segmentKey || questionIndex < 0) {
    return NextResponse.json(
      { error: "courseId, segmentKey, and questionIndex are required" },
      { status: 400 },
    );
  }

  let questionKey = "";
  let spentAudio = 0;
  let spentVideo = 0;

  async function bookCosts() {
    if (!questionKey) return null;
    try {
      await addProductionCost(courseId, questionKey, "audio", spentAudio);
      return await addProductionCost(courseId, questionKey, "video", spentVideo);
    } catch {
      return null;
    }
  }

  try {
    const curriculum = await getCourseCurriculum(courseId);
    if (!curriculum) return NextResponse.json({ error: "Course has no curriculum" }, { status: 400 });

    const renderable = flattenQuestions(curriculum).find(
      q => q.parentSegmentKey === segmentKey && q.questionIndex === questionIndex,
    );
    if (!renderable) {
      return NextResponse.json({ error: `No question ${questionIndex} on ${segmentKey}` }, { status: 404 });
    }
    questionKey = renderable.questionKey;

    await syncCardsForCourse(courseId);
    const production = await getCardProduction(courseId, questionKey);
    const parentProduction = await getCardProduction(courseId, segmentKey);

    // Seedance requires a reference image alongside reference audio —
    // question videos reuse the parent segment's production board.
    if (!parentProduction.board_r2_key) {
      return NextResponse.json(
        { error: "Generate the parent segment's board first — question videos reuse it" },
        { status: 400 },
      );
    }

    const replicate = getReplicate();

    // ── 1. Question audio (video length = audio rounded up, within Seedance's 4–15s) ──
    const clampDuration = (seconds: number) =>
      Math.min(VIDEO_DURATION_SECONDS, Math.max(MIN_QUESTION_VIDEO_SECONDS, Math.ceil(seconds)));

    let audioKey = production.audio_r2_key ?? null;
    let audioDuration = production.audio_duration ?? null;

    if (force || !audioKey || production.source_script !== renderable.question) {
      const { output, predictTimeSeconds } = await runWithMetrics(replicate, KOKORO_MODEL, {
        text: renderable.question,
        speed: SPEED,
        voice: VOICE,
      });
      spentAudio += (predictTimeSeconds ?? 0) * KOKORO_USD_PER_COMPUTE_SECOND;
      const audioBuffer = await fetchOutputBuffer(output);
      audioDuration = Number(wavDurationSeconds(audioBuffer).toFixed(2));

      audioKey = segmentAudioKey(courseId, questionKey);
      await uploadObject(audioKey, audioBuffer, "audio/wav");
      await mergeCardProduction(courseId, questionKey, {
        source_script: renderable.question,
        final_script: renderable.question,
        audio_r2_key: audioKey,
        audio_duration: audioDuration,
      });
    }

    // Recompute (not just read) so previously-stored out-of-range values self-heal.
    const videoDuration = clampDuration(audioDuration ?? MIN_QUESTION_VIDEO_SECONDS);
    if (videoDuration !== production.video_duration) {
      await mergeCardProduction(courseId, questionKey, { video_duration: videoDuration });
    }

    // ── 2. Alternate answers ──
    let altAnswers = production.alt_answers ?? null;
    if (force || !altAnswers?.length) {
      const altResult = await runTextPrompt(
        buildAltAnswersPrompt(renderable.question, renderable.answer),
      );
      spentAudio += altResult.costUsd;
      altAnswers = parseAlternates(altResult.text, renderable.answer);
      await mergeCardProduction(courseId, questionKey, { alt_answers: altAnswers });
    }

    // ── 3. Video prompt ──
    let videoPrompt = production.video_prompt ?? null;
    if (force || !videoPrompt) {
      const promptResult = await runTextPrompt(
        buildQuestionVideoPromptPrompt(renderable.question, videoDuration, parentProduction.board_tiles),
      );
      spentVideo += promptResult.costUsd;
      videoPrompt = promptResult.text;
      await mergeCardProduction(courseId, questionKey, { video_prompt: videoPrompt });
    }

    // ── 4. Video ──
    const output = await replicate.run(SEEDANCE_MODEL, {
      input: {
        seed: SEED,
        prompt: videoPrompt.slice(0, 4000),
        duration: videoDuration,
        resolution: "480p",
        aspect_ratio: "9:16",
        generate_audio: true,
        reference_audios: [await getVideoUrl(audioKey!)],
        reference_images: [await getVideoUrl(parentProduction.board_r2_key)],
        reference_videos: [],
      },
    });
    spentVideo += videoDuration * SEEDANCE_USD_PER_VIDEO_SECOND;

    const videoBuffer = await fetchOutputBuffer(output);
    const videoKey = segmentVideoKey(courseId, questionKey);
    await uploadVideo(videoKey, videoBuffer);
    await updateCardForSegment(courseId, questionKey, { video_r2_key: videoKey, captions: null });
    const costs = await bookCosts();

    return NextResponse.json({
      url: await getVideoUrl(videoKey),
      audioUrl: await getVideoUrl(audioKey!),
      audioDuration,
      videoDuration,
      altAnswers,
      videoPrompt,
      costs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Question video generation failed";
    const costs = await bookCosts();
    return NextResponse.json({ error: message, costs }, { status: 500 });
  }
}
