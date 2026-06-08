"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, type Course } from "@/lib/supabase";

const VISIBILITY_STYLES: Record<string, string> = {
  private:  "bg-white/5 text-[var(--muted)]",
  unlisted: "bg-yellow-500/10 text-yellow-400",
  public:   "bg-green-500/10 text-green-400",
};

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [visibility, setVisibility] = useState<Course["visibility"]>("private");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, description, cover_image_url, visibility, created_at, deleted_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setCourses(data as Course[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setCreateMsg(null);

    const { error } = await supabase.from("courses").insert({
      title: title.trim(),
      description: description.trim() || null,
      cover_image_url: coverUrl.trim() || null,
      visibility,
    });

    setCreating(false);
    if (error) {
      setCreateMsg({ text: error.message, ok: false });
    } else {
      setCreateMsg({ text: "Course created.", ok: true });
      setTitle(""); setDescription(""); setCoverUrl(""); setVisibility("private");
      load();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this course?")) return;
    await supabase.from("courses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    load();
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)", color: "var(--foreground)" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-1">Aretay Admin</h1>
          <p style={{ color: "var(--muted)" }} className="text-sm">Course management · Video studio</p>
        </div>

        {/* create form */}
        <div className="rounded-xl border p-6 mb-8" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-5" style={{ color: "var(--muted)" }}>
            New course
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Title *</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Intro to Swift"
                required
                className="w-full rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1"
                style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A short overview…"
                rows={2}
                className="w-full rounded-md px-3 py-2 text-sm resize-none focus:outline-none"
                style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Cover image URL</label>
                <input
                  value={coverUrl}
                  onChange={e => setCoverUrl(e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: "var(--muted)" }}>Visibility</label>
                <select
                  value={visibility}
                  onChange={e => setVisibility(e.target.value as Course["visibility"])}
                  className="w-full rounded-md px-3 py-2 text-sm focus:outline-none"
                  style={{ background: "var(--background)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  <option value="private">private</option>
                  <option value="unlisted">unlisted</option>
                  <option value="public">public</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 rounded-md text-sm font-semibold disabled:opacity-40"
                style={{ background: "var(--accent)", color: "#0b0d10" }}
              >
                {creating ? "Adding…" : "Add course"}
              </button>
              {createMsg && (
                <span className="text-sm" style={{ color: createMsg.ok ? "#6fcf97" : "#ff6b6b" }}>
                  {createMsg.text}
                </span>
              )}
            </div>
          </form>
        </div>

        {/* course list */}
        <div className="rounded-xl border" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              All courses
            </h2>
            <button
              onClick={load}
              className="text-xs px-3 py-1.5 rounded-md border"
              style={{ color: "var(--muted)", borderColor: "var(--border)" }}
            >
              ↻ Refresh
            </button>
          </div>

          {loading && (
            <p className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>Loading…</p>
          )}
          {error && (
            <p className="text-center py-10 text-sm" style={{ color: "#ff6b6b" }}>{error}</p>
          )}
          {!loading && !error && courses.length === 0 && (
            <p className="text-center py-10 text-sm italic" style={{ color: "var(--muted)" }}>No courses yet.</p>
          )}
          {!loading && !error && courses.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                  {["Title", "Description", "Visibility", "Created", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courses.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-white/[0.02]" style={{ borderColor: "var(--border)" }}>
                    <td className="px-5 py-3 font-medium max-w-[200px] truncate">{c.title}</td>
                    <td className="px-5 py-3 max-w-[240px] truncate" style={{ color: "var(--muted)" }}>
                      {c.description ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${VISIBILITY_STYLES[c.visibility]}`}>
                        {c.visibility}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs" style={{ color: "var(--muted)" }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/courses/${c.id}`}
                          className="text-xs px-3 py-1.5 rounded-md border font-medium"
                          style={{ color: "var(--accent)", borderColor: "var(--border)" }}
                        >
                          Studio →
                        </Link>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="text-xs px-3 py-1.5 rounded-md border"
                          style={{ color: "#ff6b6b", borderColor: "var(--border)" }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
