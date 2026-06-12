"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Player } from "@remotion/player";
import type { Caption } from "@remotion/captions";
import type { Course } from "@/lib/supabase";
import type { CurriculumLesson, CurriculumQuestion, EnrichedScriptFields, QuestionAsset } from "@/lib/curriculum";
import { questionSegmentKey } from "@/lib/curriculum";
import type { ProductionCosts } from "@/lib/production";
import { lessonSegmentKey } from "@/lib/curriculum";
import { LessonVideo } from "@/remotion/LessonVideo";

const LESSON_FPS = 30;
const LESSON_DURATION_FRAMES = LESSON_FPS * 15;

type PipelineStage = "audio" | "board" | "prompt" | "video" | "captions";

const STAGES: { key: PipelineStage; label: string; hint: string }[] = [
  { key: "audio", label: "Audio", hint: "Kokoro narration — auto-trims the script until it fits in 15s…" },
  { key: "board", label: "Board", hint: "Designing + rendering the visual production board (GPT Image)…" },
  { key: "prompt", label: "Prompt", hint: "Writing the Seedance video prompt from the script + board panels…" },
  { key: "video", label: "Video", hint: "Seedance 2.0 with narration + board references — this can take several minutes…" },
  { key: "captions", label: "Captions", hint: "Whisper.cpp transcribing locally — first run downloads the model (~1.5 GB)…" },
];

class PipelineError extends Error {
  data: Record<string, unknown>;
  constructor(message: string, data: Record<string, unknown>) {
    super(message);
    this.data = data;
  }
}

async function postJson(url: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new PipelineError(data.error ?? `Request to ${url} failed`, data);
  return data;
}

function formatUsd(n: number): string {
  return n > 0 && n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

function RegenButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`Regenerate ${label.toLowerCase()}${label === "Audio" || label === "Board" ? " (also clears the video prompt, since it depends on this)" : ""}`}
      className="px-2 py-1 rounded-md text-[10px] font-semibold border disabled:opacity-40"
      style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--background)" }}
    >
      ↻ {label}
    </button>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          {label}
        </span>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(text)}
          className="text-[10px] px-1.5 py-0.5 rounded border"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          Copy
        </button>
      </div>
      <pre
        className="text-[11px] leading-relaxed whitespace-pre-wrap rounded border p-2.5 m-0 font-mono"
        style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--foreground)" }}
      >
        {text}
      </pre>
    </div>
  );
}

function StagePills({
  active,
  failed,
  done,
}: {
  active: PipelineStage | null;
  failed: PipelineStage | null;
  done: Record<PipelineStage, boolean>;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {STAGES.map((stage, i) => {
        const isActive = active === stage.key;
        const isFailed = failed === stage.key;
        const isDone = done[stage.key];
        return (
          <div key={stage.key} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-[10px]" style={{ color: "var(--border)" }}>→</span>}
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
              style={{
                borderColor: isFailed ? "#ff6b6b" : isActive ? "var(--accent)" : "var(--border)",
                color: isFailed ? "#ff6b6b" : isActive ? "var(--accent)" : isDone ? "#6fcf97" : "var(--muted)",
                background: "var(--background)",
              }}
            >
              {isDone ? "✓ " : isActive ? "● " : isFailed ? "✕ " : ""}
              {stage.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScriptCard({
  courseId,
  script,
  videoRetries,
}: {
  courseId: string;
  script: EnrichedScriptFields;
  videoRetries: number;
}) {
  const [stage, setStage] = useState<PipelineStage | null>(null);
  const [failedStage, setFailedStage] = useState<PipelineStage | null>(null);
  const [videoAttempt, setVideoAttempt] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(script.video_url);
  const [audioUrl, setAudioUrl] = useState<string | null>(script.audio_url);
  const [audioDuration, setAudioDuration] = useState<number | null>(script.audio_duration);
  const [boardUrl, setBoardUrl] = useState<string | null>(script.board_url);
  const [finalScript, setFinalScript] = useState<string | null>(script.final_script);
  const [boardPrompt, setBoardPrompt] = useState<string | null>(script.board_prompt);
  const [videoPrompt, setVideoPrompt] = useState<string | null>(script.video_prompt);
  const [costs, setCosts] = useState<ProductionCosts | null>(script.costs);
  const [captions, setCaptions] = useState<Caption[] | null>(script.captions ?? null);
  const [error, setError] = useState<string | null>(null);

  function applyCosts(value: unknown) {
    if (value && typeof value === "object" && "total_usd" in value) {
      setCosts(value as ProductionCosts);
    }
  }

  useEffect(() => {
    setVideoUrl(script.video_url);
    setCaptions(script.captions ?? null);
    setAudioUrl(script.audio_url);
    setAudioDuration(script.audio_duration);
    setBoardUrl(script.board_url);
    setFinalScript(script.final_script);
    setBoardPrompt(script.board_prompt);
    setVideoPrompt(script.video_prompt);
    setCosts(script.costs);
  }, [script.video_url, script.captions, script.audio_url, script.audio_duration, script.board_url, script.final_script, script.board_prompt, script.video_prompt, script.costs]);

  const generating = stage !== null;

  /**
   * Runs the full flow, creating only what's missing: cached audio, board,
   * and video prompt are reused as-is; the video itself always generates.
   * Use the per-part ↻ buttons to force-redo an individual input.
   */
  async function runPipeline() {
    setError(null);
    setFailedStage(null);

    let current: PipelineStage = "audio";
    try {
      setStage("audio");
      const audio = await postJson("/api/generate-audio", {
        script: script.script,
        courseId,
        segmentKey: script.segmentKey,
      });
      setAudioUrl(audio.audioUrl);
      setAudioDuration(audio.duration);
      setFinalScript(audio.finalScript !== script.script ? audio.finalScript : null);
      applyCosts(audio.costs);

      current = "board";
      setStage("board");
      const board = await postJson("/api/generate-board", {
        courseId,
        segmentKey: script.segmentKey,
      });
      setBoardUrl(board.boardUrl);
      if (typeof board.boardPrompt === "string") setBoardPrompt(board.boardPrompt);
      applyCosts(board.costs);

      current = "prompt";
      setStage("prompt");
      const prompt = await postJson("/api/generate-video-prompt", {
        courseId,
        segmentKey: script.segmentKey,
      });
      setVideoPrompt(prompt.videoPrompt);
      applyCosts(prompt.costs);

      current = "video";
      setStage("video");
      setCaptions(null);

      // Auto-retry the video render with the SAME stored inputs — audio,
      // board, and prompt are never touched here; only the ↻ buttons change them.
      let lastError: unknown = null;
      let freshVideoUrl: string | null = null;
      for (let attempt = 1; attempt <= videoRetries; attempt++) {
        setVideoAttempt(attempt);
        try {
          const video = await postJson("/api/generate-video", {
            courseId,
            segmentKey: script.segmentKey,
          });
          setVideoUrl(video.url);
          freshVideoUrl = video.url;
          applyCosts(video.costs);
          lastError = null;
          break;
        } catch (err) {
          lastError = err;
          if (err instanceof PipelineError) applyCosts(err.data.costs);
        }
      }
      if (lastError) {
        const message = lastError instanceof Error ? lastError.message : "Video generation failed";
        throw new Error(
          videoRetries > 1 ? `Failed after ${videoRetries} attempts — ${message}` : message,
        );
      }

      // Captions run automatically on every fresh video.
      current = "captions";
      setStage("captions");
      await transcribeOnce(freshVideoUrl!);
    } catch (err) {
      setFailedStage(current);
      setError(err instanceof Error ? err.message : "Pipeline failed");
      // Surface the prompt Seedance rejected so it can be inspected.
      if (err instanceof PipelineError) {
        if (typeof err.data.videoPrompt === "string") setVideoPrompt(err.data.videoPrompt);
        applyCosts(err.data.costs);
      }
    } finally {
      setStage(null);
      setVideoAttempt(0);
    }
  }

  /** Force-regenerates one input. New audio or board invalidates the stored video prompt. */
  async function regeneratePart(part: "audio" | "board" | "prompt") {
    setError(null);
    setFailedStage(null);
    setStage(part);

    try {
      if (part === "audio") {
        const audio = await postJson("/api/generate-audio", {
          script: script.script,
          courseId,
          segmentKey: script.segmentKey,
          force: true,
        });
        setAudioUrl(audio.audioUrl);
        setAudioDuration(audio.duration);
        setFinalScript(audio.finalScript !== script.script ? audio.finalScript : null);
        applyCosts(audio.costs);
        setVideoPrompt(null);
      } else if (part === "board") {
        const board = await postJson("/api/generate-board", {
          courseId,
          segmentKey: script.segmentKey,
          force: true,
        });
        setBoardUrl(board.boardUrl);
        if (typeof board.boardPrompt === "string") setBoardPrompt(board.boardPrompt);
        applyCosts(board.costs);
        setVideoPrompt(null);
      } else {
        const prompt = await postJson("/api/generate-video-prompt", {
          courseId,
          segmentKey: script.segmentKey,
          force: true,
        });
        setVideoPrompt(prompt.videoPrompt);
        applyCosts(prompt.costs);
      }
    } catch (err) {
      setFailedStage(part);
      setError(err instanceof Error ? err.message : "Regeneration failed");
      if (err instanceof PipelineError) applyCosts(err.data.costs);
    } finally {
      setStage(null);
    }
  }

  /** Raw transcription call — throws on failure so the pipeline catch handles it. */
  async function transcribeOnce(url: string) {
    const data = await postJson("/api/transcribe-captions", {
      videoUrl: url,
      courseId,
      segmentKey: script.segmentKey,
    });
    setCaptions(data.captions);
  }

  /** Re-runs captions only — used by ↻ Captions and the retry after a captions failure. */
  async function runCaptionsOnly() {
    if (!videoUrl) return;
    setError(null);
    setFailedStage(null);
    setStage("captions");
    try {
      await transcribeOnce(videoUrl);
    } catch (err) {
      setFailedStage("captions");
      setError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setStage(null);
    }
  }

  const label =
    script.kind === "intro"
      ? "Intro"
      : `${script.unitTitle ?? "Lesson"} · Segment ${script.segmentNumber}`;

  const mainButtonLabel = generating
    ? "Generating…"
    : failedStage === "captions"
      ? "Retry captions"
      : failedStage === "video"
        ? "Retry video"
        : videoUrl
          ? "Regenerate video"
          : "Generate video";

  let stageHint = stage ? STAGES.find(s => s.key === stage)?.hint ?? null : null;
  if (stage === "video" && videoAttempt > 0 && videoRetries > 1) {
    stageHint = `Attempt ${videoAttempt}/${videoRetries} — ${stageHint}`;
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{ background: "var(--background)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ background: "var(--panel)", color: "var(--muted)" }}
            >
              {script.segmentKey}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{label}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StagePills
              active={stage}
              failed={failedStage}
              done={{
                audio: !!audioUrl,
                board: !!boardUrl,
                prompt: !!videoPrompt,
                video: !!videoUrl,
                captions: !!captions && captions.length > 0,
              }}
            />
            {costs && costs.total_usd > 0 && (
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                title={`Spent so far — audio ${formatUsd(costs.audio_usd)} · board ${formatUsd(costs.board_usd)} · video ${formatUsd(costs.video_usd)}`}
                style={{ borderColor: "var(--border)", color: "#6fcf97", background: "var(--background)" }}
              >
                {formatUsd(costs.total_usd)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => (failedStage === "captions" ? runCaptionsOnly() : runPipeline())}
            disabled={generating}
            title="Runs the full flow — creates missing inputs, reuses what exists, generates the video, then captions it"
            className="px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#0b0d10" }}
          >
            {mainButtonLabel}
          </button>
        </div>
      </div>

      {stageHint && (
        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          {stageHint}
        </p>
      )}
      {error && (
        <p className="text-xs mb-3" style={{ color: "#ff6b6b" }}>{error}</p>
      )}

      {(videoUrl || audioUrl || boardUrl) && (
        <div className="flex gap-4 mb-3 items-start flex-wrap">
          {videoUrl && (
            <div className="rounded-lg border overflow-hidden shrink-0" style={{ borderColor: "var(--border)" }}>
              {captions && captions.length > 0 ? (
                <Player
                  component={LessonVideo}
                  inputProps={{ videoUrl, captions }}
                  durationInFrames={LESSON_DURATION_FRAMES}
                  fps={LESSON_FPS}
                  compositionWidth={1080}
                  compositionHeight={1920}
                  style={{ width: 200, aspectRatio: "9/16" }}
                  controls
                />
              ) : (
                <video src={videoUrl} controls playsInline preload="none" style={{ width: 200, aspectRatio: "9/16", display: "block" }} />
              )}
            </div>
          )}
          <div className="flex flex-col gap-2 min-w-0">
            {audioUrl && (
              <div className="flex items-center gap-2">
                <audio src={audioUrl} controls preload="none" style={{ height: 28, maxWidth: 220 }} />
                {audioDuration != null && (
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                    {audioDuration.toFixed(1)}s
                  </span>
                )}
              </div>
            )}
            {boardUrl && (
              <a href={boardUrl} target="_blank" rel="noreferrer" title="Open visual production board" className="block w-fit">
                <img
                  src={boardUrl}
                  alt="Visual production board"
                  className="rounded-md border object-cover"
                  style={{ height: 88, width: 88, borderColor: "var(--border)" }}
                />
              </a>
            )}
            {(audioUrl || boardUrl || videoPrompt || videoUrl) && (
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Redo
                </span>
                {audioUrl && <RegenButton label="Audio" onClick={() => regeneratePart("audio")} disabled={generating} />}
                {boardUrl && <RegenButton label="Board" onClick={() => regeneratePart("board")} disabled={generating} />}
                {videoPrompt && <RegenButton label="Prompt" onClick={() => regeneratePart("prompt")} disabled={generating} />}
                {videoUrl && <RegenButton label="Captions" onClick={() => runCaptionsOnly()} disabled={generating} />}
              </div>
            )}
          </div>
        </div>
      )}

      <p className="text-sm leading-relaxed">{finalScript ?? script.script}</p>
      {finalScript && (
        <p className="text-[10px] mt-1.5" style={{ color: "var(--muted)" }}>
          ✂ Trimmed to fit 15s narration · original: <span className="line-through opacity-70">{script.script}</span>
        </p>
      )}

      {(finalScript || boardPrompt || videoPrompt) && (
        <details className="mt-3 rounded-md border" style={{ borderColor: "var(--border)" }} open={!!error && failedStage === "video"}>
          <summary
            className="text-[11px] font-semibold px-3 py-2 cursor-pointer select-none"
            style={{ color: "var(--muted)" }}
          >
            Production details
            {videoPrompt && failedStage === "video" && (
              <span className="ml-2 font-normal" style={{ color: "#ff6b6b" }}>
                — this video prompt was rejected
              </span>
            )}
          </summary>
          <div className="px-3 pb-3 space-y-3">
            {costs && costs.total_usd > 0 && (
              <p className="text-[11px] m-0" style={{ color: "var(--muted)" }}>
                Spent so far: <span style={{ color: "#6fcf97" }}>{formatUsd(costs.total_usd)}</span>
                {" — "}audio {formatUsd(costs.audio_usd)} · board {formatUsd(costs.board_usd)} · video {formatUsd(costs.video_usd)}
              </p>
            )}
            <PromptBlock label={finalScript ? "Narrated script (trimmed)" : "Narrated script"} text={finalScript ?? script.script} />
            {boardPrompt && <PromptBlock label="Board image prompt" text={boardPrompt} />}
            {videoPrompt && <PromptBlock label="Video prompt (Seedance)" text={videoPrompt} />}
          </div>
        </details>
      )}
    </div>
  );
}

function QuestionCard({
  courseId,
  parentSegmentKey,
  questionIndex,
  question,
  asset,
  videoRetries,
}: {
  courseId: string;
  parentSegmentKey: string;
  questionIndex: number;
  question: CurriculumQuestion;
  asset: QuestionAsset | undefined;
  videoRetries: number;
}) {
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(asset?.audio_url ?? null);
  const [videoUrl, setVideoUrl] = useState<string | null>(asset?.video_url ?? null);
  const [videoDuration, setVideoDuration] = useState<number | null>(asset?.video_duration ?? null);
  const [altAnswers, setAltAnswers] = useState<string[] | null>(asset?.alt_answers ?? null);
  const [costs, setCosts] = useState<ProductionCosts | null>(asset?.costs ?? null);
  const [error, setError] = useState<string | null>(null);

  async function generate(force: boolean) {
    setBusy(true);
    setError(null);

    let lastError: unknown = null;
    for (let i = 1; i <= videoRetries; i++) {
      setAttempt(i);
      try {
        const data = await postJson("/api/generate-question-video", {
          courseId,
          segmentKey: parentSegmentKey,
          questionIndex,
          // Only force fresh inputs on the first attempt — retries reuse them.
          force: force && i === 1,
        });
        setVideoUrl(data.url);
        setAudioUrl(data.audioUrl);
        setVideoDuration(data.videoDuration);
        if (Array.isArray(data.altAnswers)) setAltAnswers(data.altAnswers);
        if (data.costs) setCosts(data.costs as ProductionCosts);
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        if (err instanceof PipelineError && err.data.costs) setCosts(err.data.costs as ProductionCosts);
      }
    }

    if (lastError) {
      const message = lastError instanceof Error ? lastError.message : "Generation failed";
      setError(videoRetries > 1 ? `Failed after ${videoRetries} attempts — ${message}` : message);
    }
    setBusy(false);
    setAttempt(0);
  }

  return (
    <div
      className="rounded-md border p-3"
      style={{ background: "var(--background)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs">
            <span className="text-white">{question.question}</span>
            {" → "}
            <span style={{ color: "#6fcf97" }}>{question.answer}</span>
          </p>
          {altAnswers && altAnswers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {altAnswers.map((alt, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded border"
                  style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                >
                  {alt}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {costs && costs.total_usd > 0 && (
            <span className="text-[10px]" style={{ color: "#6fcf97" }}>{formatUsd(costs.total_usd)}</span>
          )}
          {videoDuration != null && (
            <span className="text-[10px]" style={{ color: "var(--muted)" }}>{videoDuration}s</span>
          )}
          <button
            type="button"
            onClick={() => generate(!!videoUrl && !error)}
            disabled={busy}
            className="px-2.5 py-1 rounded-md text-[10px] font-semibold disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#0b0d10" }}
          >
            {busy
              ? videoRetries > 1 && attempt > 0
                ? `Attempt ${attempt}/${videoRetries}…`
                : "Generating…"
              : error
                ? "Retry"
                : videoUrl
                  ? "Regenerate"
                  : "Create video"}
          </button>
        </div>
      </div>

      {busy && (
        <p className="text-[10px] mt-2" style={{ color: "var(--muted)" }}>
          Question audio → alternates → prompt → Seedance (clip length = audio rounded up)…
        </p>
      )}
      {error && <p className="text-[10px] mt-2" style={{ color: "#ff6b6b" }}>{error}</p>}

      {(audioUrl || videoUrl) && (
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {audioUrl && <audio src={audioUrl} controls preload="none" style={{ height: 24, maxWidth: 200 }} />}
          {videoUrl && (
            <video
              src={videoUrl}
              controls
              playsInline
              preload="none"
              className="rounded border"
              style={{ width: 110, aspectRatio: "9/16", borderColor: "var(--border)" }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function LessonSection({
  courseId,
  lesson,
  scriptsByKey,
  questionAssets,
  videoRetries,
}: {
  courseId: string;
  lesson: CurriculumLesson;
  scriptsByKey: Map<string, EnrichedScriptFields>;
  questionAssets: Record<string, QuestionAsset>;
  videoRetries: number;
}) {
  return (
    <div
      className="rounded-xl border p-5 space-y-3"
      style={{ background: "var(--panel)", borderColor: "var(--border)" }}
    >
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {lesson.level != null ? `Level ${lesson.level}` : `Chapter ${lesson.order}`}
          </span>
          {lesson.parent_unit && (
            <>
              <span className="text-xs" style={{ color: "var(--muted)" }}>·</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>{lesson.parent_unit}</span>
            </>
          )}
        </div>
        <h3 className="font-semibold text-base">{lesson.unit_title}</h3>
      </div>

      {lesson.segments.map(segment => {
        const key = lessonSegmentKey(lesson.order, segment.segment_number);
        const enriched = scriptsByKey.get(key);
        if (!enriched) return null;

        return (
          <div key={key}>
            <ScriptCard courseId={courseId} script={enriched} videoRetries={videoRetries} />
            {segment.questions.length > 0 && (
              <div className="mt-2 ml-2 pl-3 border-l space-y-2" style={{ borderColor: "var(--border)" }}>
                {segment.questions.map((q, i) => (
                  <QuestionCard
                    key={i}
                    courseId={courseId}
                    parentSegmentKey={key}
                    questionIndex={i}
                    question={q}
                    asset={questionAssets[questionSegmentKey(lesson.order, segment.segment_number, i)]}
                    videoRetries={videoRetries}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Client-side cost estimates for the "Generate all" confirmation.
// Seedance: $0.08/output-second; boards/covers are GPT Image; LLM calls are cents.
const EST = {
  segmentVideo: 1.2, // Seedance 15s × $0.08/s
  questionVideo: 0.4, // Seedance ~5s × $0.08/s
  board: 0.3, // GPT Image
  cover: 0.25, // GPT Image
  segmentLlm: 0.05, // board design + video prompt
  questionLlm: 0.05, // alternate answers + video prompt
};

type BulkQuestionItem = { parentSegmentKey: string; questionIndex: number; label: string };

type BulkCostLine = { label: string; usd: number };

type BulkPlan = {
  segments: EnrichedScriptFields[];
  captionOnly: EnrichedScriptFields[];
  questions: BulkQuestionItem[];
  needsCover: boolean;
  costLines: BulkCostLine[];
  totalUsd: number;
};

type BulkState =
  | { phase: "confirm"; plan: BulkPlan }
  | { phase: "running"; total: number; done: number; failed: string[]; active: string[]; stopping: boolean }
  | { phase: "done"; total: number; done: number; failed: string[] };

// Status shape returned by /api/generate-all — the job itself runs in the
// server process, so it survives page reloads; the page just polls it.
type ServerBulkJob = {
  phase: "running" | "done";
  total: number;
  done: number;
  failed: string[];
  active: string[];
  stopping: boolean;
};

function jobToBulkState(job: ServerBulkJob): BulkState {
  return job.phase === "done"
    ? { phase: "done", total: job.total, done: job.done, failed: job.failed }
    : {
        phase: "running",
        total: job.total,
        done: job.done,
        failed: job.failed,
        active: job.active,
        stopping: job.stopping,
      };
}

export default function CourseStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoRetries, setVideoRetries] = useState(4);
  const [coverBusy, setCoverBusy] = useState(false);
  const [bulk, setBulk] = useState<BulkState | null>(null);

  async function loadCourse() {
    try {
      const res = await fetch(`/api/courses/${id}`);
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Course not found");
      else setCourse(data.course as Course);
    } catch {
      setError("Network error while loading course.");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadCourse();
  }, [id]);

  // Poll the server-side bulk job while it runs, and re-attach to an
  // in-flight job after a page reload (the job itself never stops).
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    async function syncJob(attach: boolean) {
      try {
        const res = await fetch(`/api/generate-all?courseId=${id}`);
        const data = await res.json();
        const job = data.job as ServerBulkJob | null;
        if (!job) return;
        if (attach && job.phase !== "running") return;
        setBulk(prev => {
          if (attach) return prev === null ? jobToBulkState(job) : prev;
          return prev?.phase === "running" ? jobToBulkState(job) : prev;
        });
        if (!attach && job.phase === "done") await loadCourse();
      } catch {
        // Transient poll failure — keep the last known state.
      }
    }

    if (bulk?.phase === "running") {
      timer = setInterval(() => void syncJob(false), 2000);
    } else if (bulk === null) {
      void syncJob(true);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [id, bulk?.phase]);

  async function handleGenerateCurriculum() {
    if (!course) return;
    setGenerating(true);
    setError(null);

    try {
      const genRes = await fetch("/api/generate-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: course.title }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        setError(genData.error ?? "Generation failed");
        return;
      }

      const patchRes = await fetch(`/api/courses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ curriculum: genData.curriculum }),
      });
      if (!patchRes.ok) {
        const patchData = await patchRes.json();
        setError(patchData.error ?? "Failed to save curriculum");
        return;
      }

      setLoading(true);
      await loadCourse();
    } catch {
      setError("Network error while generating curriculum.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateCover() {
    setCoverBusy(true);
    setError(null);
    try {
      const data = await postJson("/api/generate-cover", { courseId: id });
      setCourse(prev => (prev ? { ...prev, cover_image_url: data.coverUrl } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover generation failed");
    } finally {
      setCoverBusy(false);
    }
  }

  function buildBulkPlan(): BulkPlan {
    const allScripts = course?.curriculum?.scripts ?? [];
    const assets = course?.curriculum?.question_assets ?? {};
    const allLessons = course?.curriculum?.lessons ?? [];

    const segments = allScripts.filter(s => !s.video_url);
    const captionOnly = allScripts.filter(s => s.video_url && (!s.captions || s.captions.length === 0));

    const questions: BulkQuestionItem[] = [];
    for (const lesson of allLessons) {
      for (const segment of lesson.segments) {
        segment.questions.forEach((_, i) => {
          const key = questionSegmentKey(lesson.order, segment.segment_number, i);
          if (!assets[key]?.video_url) {
            questions.push({
              parentSegmentKey: lessonSegmentKey(lesson.order, segment.segment_number),
              questionIndex: i,
              label: key,
            });
          }
        });
      }
    }

    const needsCover = !course?.cover_image_url;
    const boardsNeeded = segments.filter(s => !s.board_url).length;

    const costLines: BulkCostLine[] = [];
    if (needsCover) costLines.push({ label: "Course cover · GPT Image", usd: EST.cover });
    if (segments.length > 0) {
      costLines.push({
        label: `${segments.length} segment videos · Seedance 15s`,
        usd: segments.length * EST.segmentVideo,
      });
      if (boardsNeeded > 0) {
        costLines.push({ label: `${boardsNeeded} visual boards · GPT Image`, usd: boardsNeeded * EST.board });
      }
      costLines.push({
        label: `${segments.length} board designs + video prompts · LLM`,
        usd: segments.length * EST.segmentLlm,
      });
    }
    if (questions.length > 0) {
      costLines.push({
        label: `${questions.length} question videos · Seedance ~5s`,
        usd: questions.length * EST.questionVideo,
      });
      costLines.push({
        label: `${questions.length} alternate-answer sets + prompts · LLM`,
        usd: questions.length * EST.questionLlm,
      });
    }
    const totalUsd = costLines.reduce((sum, line) => sum + line.usd, 0);

    return { segments, captionOnly, questions, needsCover, costLines, totalUsd };
  }

  // The bulk job runs server-side (lib/bulk-job.ts) so a page reload
  // doesn't kill it — the page only starts, stops, and polls it.
  async function startBulk(plan: BulkPlan) {
    const total =
      plan.segments.length + plan.captionOnly.length + plan.questions.length + (plan.needsCover ? 1 : 0);
    setBulk({ phase: "running", total, done: 0, failed: [], active: [], stopping: false });
    try {
      const data = await postJson("/api/generate-all", { courseId: id, videoRetries });
      setBulk(jobToBulkState(data.job as ServerBulkJob));
    } catch (err) {
      setBulk(null);
      setError(err instanceof Error ? err.message : "Failed to start bulk generation");
    }
  }

  function stopBulk() {
    setBulk(prev => (prev?.phase === "running" ? { ...prev, stopping: true } : prev));
    void fetch(`/api/generate-all?courseId=${id}`, { method: "DELETE" });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <p className="text-sm" style={{ color: "#ff6b6b" }}>{error ?? "Course not found."}</p>
      </div>
    );
  }

  const curriculum = course.curriculum;
  const scripts = curriculum?.scripts ?? [];
  const scriptsByKey = new Map(scripts.map(s => [s.segmentKey, s]));
  const introScript = scriptsByKey.get("intro");
  const lessons = [...(curriculum?.lessons ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 text-sm min-w-0" style={{ color: "var(--muted)" }}>
            <Link href="/" className="hover:text-white transition-colors">Courses</Link>
            <span>/</span>
            <span className="text-white truncate">{course.title}</span>
          </div>
          {curriculum && (
            <button
              type="button"
              onClick={() => setBulk({ phase: "confirm", plan: buildBulkPlan() })}
              disabled={bulk?.phase === "running"}
              className="px-4 py-2 rounded-md text-xs font-semibold shrink-0 disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#0b0d10" }}
            >
              Generate all content
            </button>
          )}
        </div>

        <div className="mb-8 flex gap-6 items-start flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight mb-0.5">{curriculum?.title ?? course.title}</h1>
            {curriculum?.subtitle && (
              <p className="text-sm mb-2" style={{ color: "var(--muted)" }}>{curriculum.subtitle}</p>
            )}
            {(curriculum?.description ?? course.description) && (
              <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
                {curriculum?.description ?? course.description}
              </p>
            )}
          </div>
          <div className="shrink-0 flex flex-col items-center gap-2">
            {course.cover_image_url ? (
              <img
                src={course.cover_image_url}
                alt="Course cover"
                className="rounded-lg object-cover border"
                style={{ borderColor: "var(--border)", width: 128, height: 192 }}
              />
            ) : (
              <div
                className="rounded-lg border flex items-center justify-center text-[10px] text-center px-2"
                style={{ borderColor: "var(--border)", color: "var(--muted)", width: 128, height: 192 }}
              >
                No cover yet
              </div>
            )}
            <button
              type="button"
              onClick={handleGenerateCover}
              disabled={coverBusy || bulk?.phase === "running"}
              className="px-2.5 py-1 rounded-md text-[10px] font-semibold border disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--background)" }}
            >
              {coverBusy ? "Generating…" : course.cover_image_url ? "↻ Cover" : "Generate cover"}
            </button>
          </div>
        </div>

        {!curriculum ? (
          <div
            className="rounded-xl border p-10 text-center text-sm space-y-4"
            style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--muted)" }}
          >
            <p>No curriculum yet.</p>
            <button
              type="button"
              onClick={handleGenerateCurriculum}
              disabled={generating}
              className="px-5 py-2 rounded-md text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#0b0d10" }}
            >
              {generating ? "Generating…" : "Generate curriculum"}
            </button>
            {generating && (
              <p className="text-xs">Calling Gemini 3.1 Pro — this may take a minute…</p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {curriculum.outline.length > 0 && (
              <div
                className="rounded-xl border p-5"
                style={{ background: "var(--panel)", borderColor: "var(--border)" }}
              >
                <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
                  Outline
                </h2>
                <ul className="space-y-2 text-sm">
                  {curriculum.outline.map(unit => (
                    <li key={unit.level_1_unit}>
                      <span className="font-medium">{unit.level_1_unit}</span>
                      <span style={{ color: "var(--muted)" }}> — {unit.summary}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div
              className="rounded-xl border px-5 py-3 flex items-center justify-between gap-4 flex-wrap"
              style={{ background: "var(--panel)", borderColor: "var(--border)" }}
            >
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Video retry policy
                </span>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                  Seedance attempts per click, with the same audio + board + prompt. Inputs only change via their ↻ buttons.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs" style={{ color: "var(--muted)" }} htmlFor="video-retries">
                  Attempts
                </label>
                <input
                  id="video-retries"
                  type="number"
                  min={1}
                  max={10}
                  value={videoRetries}
                  onChange={e =>
                    setVideoRetries(Math.max(1, Math.min(10, Math.round(Number(e.target.value)) || 1)))
                  }
                  className="w-16 px-2 py-1.5 rounded-md border text-sm text-center"
                  style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)" }}
                />
              </div>
            </div>

            {introScript && (
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--muted)" }}>
                  Intro
                </h2>
                <ScriptCard courseId={id} script={introScript} videoRetries={videoRetries} />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
                  Lessons
                </h2>
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  {lessons.length} lessons · {scripts.length} script sections
                </span>
              </div>
              <div className="space-y-4">
                {lessons.map(lesson => (
                  <LessonSection
                    key={lesson.order}
                    courseId={id}
                    lesson={lesson}
                    scriptsByKey={scriptsByKey}
                    questionAssets={curriculum?.question_assets ?? {}}
                    videoRetries={videoRetries}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {bulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.65)" }}>
          <div
            className="rounded-xl border p-6 w-full max-w-md max-h-[80vh] overflow-y-auto"
            style={{ background: "var(--panel)", borderColor: "var(--border)" }}
          >
            {bulk.phase === "confirm" && (
              <>
                <h2 className="text-base font-bold mb-1">Generate all content</h2>
                <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
                  Creates everything that&apos;s missing — existing videos, boards, and prompts are left untouched.
                  Runs on the server — you can close or reload this page and it keeps going.
                </p>
                <div className="space-y-2 text-sm mb-4">
                  {bulk.plan.costLines.map(line => (
                    <div key={line.label} className="flex justify-between">
                      <span>{line.label}</span>
                      <span style={{ color: "var(--muted)" }}>~{formatUsd(line.usd)}</span>
                    </div>
                  ))}
                  {bulk.plan.segments.length + bulk.plan.questions.length > 0 && (
                    <div className="flex justify-between">
                      <span>
                        {bulk.plan.segments.length + bulk.plan.questions.length} narration audios · Kokoro
                      </span>
                      <span style={{ color: "var(--muted)" }}>~free</span>
                    </div>
                  )}
                  {bulk.plan.segments.length + bulk.plan.captionOnly.length > 0 && (
                    <div className="flex justify-between">
                      <span>
                        {bulk.plan.segments.length + bulk.plan.captionOnly.length} captions · local Whisper
                      </span>
                      <span style={{ color: "var(--muted)" }}>free</span>
                    </div>
                  )}
                  <div
                    className="flex justify-between pt-2 border-t font-semibold"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <span>Estimated total</span>
                    <span style={{ color: "#6fcf97" }}>~{formatUsd(bulk.plan.totalUsd)}</span>
                  </div>
                </div>
                <p className="text-[10px] mb-4" style={{ color: "var(--muted)" }}>
                  Estimate only — flagged/failed Seedance runs aren&apos;t billed, and each video retries up to {videoRetries}×
                  with cached inputs. Question clips are estimated at ~5s.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setBulk(null)}
                    className="px-4 py-2 rounded-md text-xs font-semibold border"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void startBulk(bulk.plan)}
                    disabled={bulk.plan.totalUsd === 0 && bulk.plan.captionOnly.length === 0}
                    className="px-4 py-2 rounded-md text-xs font-semibold disabled:opacity-40"
                    style={{ background: "var(--accent)", color: "#0b0d10" }}
                  >
                    Generate (~{formatUsd(bulk.plan.totalUsd)})
                  </button>
                </div>
              </>
            )}

            {bulk.phase === "running" && (
              <>
                <h2 className="text-base font-bold mb-1">Generating…</h2>
                <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
                  {bulk.done + bulk.failed.length}/{bulk.total} complete
                  {bulk.failed.length > 0 && ` · ${bulk.failed.length} failed`}
                </p>
                <div className="rounded-full h-1.5 mb-4 overflow-hidden" style={{ background: "var(--border)" }}>
                  <div
                    className="h-full transition-all"
                    style={{
                      background: "var(--accent)",
                      width: `${Math.round(((bulk.done + bulk.failed.length) / Math.max(1, bulk.total)) * 100)}%`,
                    }}
                  />
                </div>
                {bulk.active.length > 0 && (
                  <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
                    Working on: <span className="text-white">{bulk.active.join(", ")}</span>
                  </p>
                )}
                {bulk.failed.length > 0 && (
                  <p className="text-[10px] mb-3" style={{ color: "#ff6b6b" }}>
                    Failed: {bulk.failed.join(", ")}
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={stopBulk}
                    className="px-4 py-2 rounded-md text-xs font-semibold border"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    {bulk.stopping ? "Stopping after current items…" : "Stop"}
                  </button>
                </div>
              </>
            )}

            {bulk.phase === "done" && (
              <>
                <h2 className="text-base font-bold mb-1">Generation complete</h2>
                <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
                  {bulk.done}/{bulk.total} succeeded
                  {bulk.failed.length > 0 && ` · ${bulk.failed.length} failed`}
                </p>
                {bulk.failed.length > 0 && (
                  <p className="text-[10px] mb-3" style={{ color: "#ff6b6b" }}>
                    Failed (retry from their cards): {bulk.failed.join(", ")}
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setBulk(null)}
                    className="px-4 py-2 rounded-md text-xs font-semibold"
                    style={{ background: "var(--accent)", color: "#0b0d10" }}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
