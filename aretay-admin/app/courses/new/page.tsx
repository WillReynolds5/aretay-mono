"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Curriculum } from "@/lib/curriculum";

const inputStyle = {
  background: "var(--background)",
  border: "1px solid var(--border)",
  color: "var(--foreground)",
};

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);

  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleGenerate() {
    if (!title.trim()) {
      setMsg({ text: "Enter a course name first.", ok: false });
      return;
    }
    if (!description.trim()) {
      setMsg({ text: "Enter a description to define the course scope.", ok: false });
      return;
    }

    setGenerating(true);
    setMsg(null);

    try {
      const res = await fetch("/api/generate-curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg({ text: data.error ?? "Generation failed", ok: false });
        return;
      }

      setCurriculum(data.curriculum);
      setMsg({ text: `Curriculum generated — ${data.curriculum.videos.length} lessons.`, ok: true });
    } catch {
      setMsg({ text: "Network error while generating curriculum.", ok: false });
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setCreating(true);
    setMsg(null);

    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          cover_image_url: coverUrl.trim(),
          curriculum,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setMsg({ text: data.error ?? "Failed to create course", ok: false });
      } else {
        router.push(`/courses/${data.id}`);
      }
    } catch {
      setMsg({ text: "Network error while creating course.", ok: false });
    }

    setCreating(false);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link href="/" className="text-xs mb-4 inline-block" style={{ color: "var(--muted)" }}>
            ← All courses
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mb-1">New course</h1>
          <p style={{ color: "var(--muted)" }} className="text-sm">
            Create a course and optionally generate its curriculum with AI.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-6">
          <div className="rounded-xl border p-6 space-y-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Name *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Western Civ: From Greece to the Fall of Rome"
                required
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Description *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Begin with ancient Greece and end with the fall of the Western Roman Empire."
                rows={3}
                required
                className="w-full rounded-md px-3 py-2 text-sm resize-none focus:outline-none"
                style={inputStyle}
              />
              <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                Used as the course scope when generating curriculum.
              </p>
            </div>

            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Cover image URL</label>
              <input
                value={coverUrl}
                onChange={e => setCoverUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none"
                style={inputStyle}
              />
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt="Cover preview"
                  className="mt-3 rounded-lg max-h-40 object-cover border"
                  style={{ borderColor: "var(--border)" }}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>
          </div>

          <div className="rounded-xl border p-6" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
            <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--muted)" }}>
              Curriculum
            </h2>

            {curriculum ? (
              <div className="mb-4 rounded-lg border p-4 text-sm" style={{ borderColor: "var(--border)" }}>
                <p className="font-medium mb-2">{curriculum.title}</p>
                <p style={{ color: "var(--muted)" }}>{curriculum.videos.length} lessons generated</p>
                <ul className="mt-3 space-y-1 max-h-48 overflow-y-auto text-xs" style={{ color: "var(--muted)" }}>
                  {curriculum.videos.map(v => (
                    <li key={v.id}>{v.date} — {v.title}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                No curriculum yet. Generate one from the course name and description.
              </p>
            )}

            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="px-5 py-2 rounded-md text-sm font-semibold border disabled:opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              {generating ? "Generating…" : "Generate curriculum"}
            </button>
            {generating && (
              <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
                Calling Claude Sonnet 4.6 — this may take a minute…
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={creating}
              className="px-5 py-2 rounded-md text-sm font-semibold disabled:opacity-40"
              style={{ background: "var(--accent)", color: "#0b0d10" }}
            >
              {creating ? "Creating…" : "Create course"}
            </button>
            {msg && (
              <span className="text-sm" style={{ color: msg.ok ? "#6fcf97" : "#ff6b6b" }}>
                {msg.text}
              </span>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
