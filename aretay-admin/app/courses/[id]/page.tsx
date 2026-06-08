"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Player } from "@remotion/player";
import type { Caption } from "@remotion/captions";
import type { Course } from "@/lib/supabase";
import type { EnrichedCurriculumVideo } from "@/lib/course-curriculum";
import { LessonVideo } from "@/remotion/LessonVideo";

const LESSON_FPS = 30;
const LESSON_DURATION_FRAMES = LESSON_FPS * 15;

function LessonCard({ courseId, lesson }: { courseId: string; lesson: EnrichedCurriculumVideo }) {
  const [generating, setGenerating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(lesson.video_url);
  const [captions, setCaptions] = useState<Caption[] | null>(lesson.captions ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setVideoUrl(lesson.video_url);
    setCaptions(lesson.captions ?? null);
  }, [lesson.video_url, lesson.captions]);

  async function handleCreateVideo() {
    setGenerating(true);
    setError(null);
    setCaptions(null);

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: lesson.prompt, courseId, lessonId: lesson.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Video generation failed");
        return;
      }

      setVideoUrl(data.url);
    } catch {
      setError("Network error while generating video.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleTranscribe() {
    if (!videoUrl) return;
    setTranscribing(true);
    setError(null);

    try {
      const res = await fetch("/api/transcribe-captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, courseId, lessonId: lesson.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Transcription failed");
        return;
      }

      setCaptions(data.captions);
    } catch {
      setError("Network error while transcribing.");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: "var(--panel)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded"
              style={{ background: "var(--background)", color: "var(--muted)" }}
            >
              #{lesson.id}
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{lesson.date}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>·</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{lesson.era}</span>
          </div>
          <h3 className="font-semibold text-base">{lesson.title}</h3>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={handleCreateVideo}
            disabled={generating || transcribing}
            className="px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-40"
            style={{ background: "var(--accent)", color: "#0b0d10" }}
          >
            {generating ? "Generating…" : videoUrl ? "Regenerate" : "Create video"}
          </button>
          {videoUrl && (
            <button
              type="button"
              onClick={handleTranscribe}
              disabled={transcribing || generating}
              className="px-4 py-2 rounded-md text-sm font-semibold border disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              {transcribing ? "Transcribing…" : captions ? "Re-transcribe" : "Add captions"}
            </button>
          )}
        </div>
      </div>

      {generating && (
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Running Seedance 2.0 — this can take several minutes…
        </p>
      )}
      {transcribing && (
        <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
          Running Whisper.cpp locally — first run downloads the model (~1.5 GB)…
        </p>
      )}
      {error && (
        <p className="text-xs mb-4" style={{ color: "#ff6b6b" }}>{error}</p>
      )}
      {videoUrl && captions && captions.length > 0 && (
        <div className="mb-4 rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <div
            className="px-4 py-2 border-b text-xs font-semibold uppercase tracking-widest"
            style={{ background: "var(--background)", borderColor: "var(--border)", color: "var(--muted)" }}
          >
            Caption preview
          </div>
          <Player
            component={LessonVideo}
            inputProps={{ videoUrl, captions }}
            durationInFrames={LESSON_DURATION_FRAMES}
            fps={LESSON_FPS}
            compositionWidth={1080}
            compositionHeight={1920}
            style={{ width: "100%", maxWidth: 320, margin: "0 auto", aspectRatio: "9/16" }}
            controls
          />
        </div>
      )}
      {videoUrl && (!captions || captions.length === 0) && (
        <div className="mb-4 rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
          <video
            src={videoUrl}
            controls
            playsInline
            className="w-full max-w-xs mx-auto"
            style={{ aspectRatio: "9/16" }}
          />
        </div>
      )}

      <div className="space-y-4 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
            Prompt
          </p>
          <p className="leading-relaxed" style={{ color: "var(--foreground)" }}>{lesson.prompt}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
            Narration
          </p>
          <p className="leading-relaxed italic" style={{ color: "var(--muted)" }}>{lesson.narration}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--muted)" }}>
            Question
          </p>
          <p className="mb-2">{lesson.question.text}</p>
          <ul className="space-y-1">
            {lesson.question.options.map((option, i) => (
              <li
                key={i}
                className="text-xs px-2.5 py-1.5 rounded-md inline-block mr-2 mb-1"
                style={{
                  background: option === lesson.question.answer ? "rgba(111, 207, 151, 0.12)" : "var(--background)",
                  color: option === lesson.question.answer ? "#6fcf97" : "var(--muted)",
                  border: `1px solid ${option === lesson.question.answer ? "rgba(111, 207, 151, 0.3)" : "var(--border)"}`,
                }}
              >
                {option}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function CourseStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
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
    load();
  }, [id]);

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

  const lessons = (course.curriculum?.videos ?? []) as EnrichedCurriculumVideo[];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 mb-8 text-sm" style={{ color: "var(--muted)" }}>
          <Link href="/" className="hover:text-white transition-colors">Courses</Link>
          <span>/</span>
          <span className="text-white">{course.title}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">{course.title}</h1>
          {course.description && (
            <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>{course.description}</p>
          )}
          {course.cover_image_url && (
            <img
              src={course.cover_image_url}
              alt=""
              className="rounded-lg max-h-48 object-cover border mt-3"
              style={{ borderColor: "var(--border)" }}
            />
          )}
        </div>

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Lessons
          </h2>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {lessons.length} {lessons.length === 1 ? "video" : "videos"}
          </span>
        </div>

        {lessons.length === 0 ? (
          <div
            className="rounded-xl border p-10 text-center text-sm"
            style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--muted)" }}
          >
            No curriculum yet. Generate one when creating the course.
          </div>
        ) : (
          <div className="space-y-4">
            {lessons.map(lesson => (
              <LessonCard key={lesson.id} courseId={id} lesson={lesson} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
