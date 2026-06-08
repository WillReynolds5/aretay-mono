"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Player } from "@remotion/player";
import { supabase, type Course } from "@/lib/supabase";
import { CourseVideo } from "@/remotion/CourseVideo";

const FPS = 30;
const DURATION_IN_FRAMES = 180; // 6 seconds

export default function CourseStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) setError(error.message);
      else setCourse(data as Course);
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

  const videoProps = {
    title: course.title,
    description: course.description ?? "",
    coverImageUrl: course.cover_image_url,
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-sm" style={{ color: "var(--muted)" }}>
          <Link href="/" className="hover:text-white transition-colors">Courses</Link>
          <span>/</span>
          <span className="text-white">{course.title}</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">{course.title}</h1>
          {course.description && (
            <p className="text-sm" style={{ color: "var(--muted)" }}>{course.description}</p>
          )}
        </div>

        {/* video preview */}
        <div className="rounded-xl border overflow-hidden mb-6" style={{ borderColor: "var(--border)" }}>
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Video Preview
            </span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {DURATION_IN_FRAMES / FPS}s · {FPS}fps · 1920×1080
            </span>
          </div>
          <Player
            component={CourseVideo}
            inputProps={videoProps}
            durationInFrames={DURATION_IN_FRAMES}
            fps={FPS}
            compositionWidth={1920}
            compositionHeight={1080}
            style={{ width: "100%", aspectRatio: "16/9" }}
            controls
          />
        </div>

        {/* render instructions */}
        <div className="rounded-xl border p-6" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted)" }}>
            Render locally
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Run the Remotion CLI from <code className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--border)", color: "var(--foreground)" }}>aretay-admin/</code> to render this composition to MP4:
          </p>
          <pre
            className="text-xs rounded-lg p-4 overflow-x-auto"
            style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--accent)" }}
          >
{`npx remotion render remotion/index.ts CourseVideo out/${course.id}.mp4 \\
  --props='${JSON.stringify(videoProps)}'`}
          </pre>
          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
            Or open Remotion Studio for a full editing interface: <code className="text-xs px-1 py-0.5 rounded" style={{ background: "var(--border)" }}>npx remotion studio remotion/index.ts</code>
          </p>
        </div>
      </div>
    </div>
  );
}
