"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GraphCanvas from "@/components/GraphCanvas";
import type { GraphListItem, SavedGraph, TreeNode } from "@/lib/types";

const SAMPLE = `France\tCapital\tParis
Japan\tCapital\tTokyo
Pacific Ocean\tLocation`;

type Tab = "graph" | "json";

type ParsedDeck = { id: number; name: string; noteCount: number };

export default function Home() {
  const [ankiText, setAnkiText] = useState(SAMPLE);
  const [graph, setGraph] = useState<SavedGraph | null>(null);
  const [savedGraphs, setSavedGraphs] = useState<GraphListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costUsd, setCostUsd] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("graph");
  const [graphKey, setGraphKey] = useState(0);
  const [apkgFile, setApkgFile] = useState<File | null>(null);
  const [apkgDecks, setApkgDecks] = useState<ParsedDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshList = useCallback(async () => {
    const res = await fetch("/api/graphs");
    if (res.ok) {
      const data = (await res.json()) as { graphs: GraphListItem[] };
      setSavedGraphs(data.graphs);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  async function parseApkg(file: File, deckId?: number) {
    setParsing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (deckId != null) form.append("deckId", String(deckId));

      const res = await fetch("/api/parse-apkg", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to parse APKG");

      setAnkiText(data.ankiText as string);
      setApkgDecks(data.decks as ParsedDeck[]);
      setSelectedDeckId(data.deckId as number);
      setSourceLabel(`${file.name} · ${data.deckName} · ${data.noteCount} notes`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse APKG");
    } finally {
      setParsing(false);
    }
  }

  async function handleApkgUpload(file: File) {
    setApkgFile(file);
    await parseApkg(file);
  }

  async function handleDeckChange(deckId: number) {
    setSelectedDeckId(deckId);
    if (apkgFile) await parseApkg(apkgFile, deckId);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setCostUsd(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ankiText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      setGraph(data as SavedGraph & { costUsd: number });
      setCostUsd(data.costUsd ?? null);
      setGraphKey(k => k + 1);
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoad(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/graphs/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Load failed");
      setGraph(data as SavedGraph);
      setCostUsd(null);
      setGraphKey(k => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    }
  }

  function handleDownload() {
    if (!graph) return;
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${graph.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border px-6 py-4">
        <h1 className="text-xl font-semibold">Aretay Graph</h1>
        <p className="mt-1 text-sm text-muted">
          Upload an Anki .apkg or paste TXT export → Gemini 3.5 Flash builds a semantic tree
        </p>
      </header>

      <main className="grid flex-1 gap-0 lg:grid-cols-2">
        {/* Input panel */}
        <section className="flex flex-col border-b border-border p-6 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-2 text-sm font-medium">Upload .apkg</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".apkg"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) void handleApkgUpload(file);
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50"
              >
                {parsing ? "Extracting…" : "Choose APKG file"}
              </button>
            </div>

            {apkgDecks.length > 1 && selectedDeckId != null && (
              <label className="text-sm">
                <span className="mb-1 block text-muted">Deck</span>
                <select
                  value={selectedDeckId}
                  onChange={e => void handleDeckChange(Number(e.target.value))}
                  disabled={parsing}
                  className="rounded-lg border border-border bg-panel px-3 py-2 outline-none focus:border-accent"
                >
                  {apkgDecks.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.noteCount})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {sourceLabel && (
            <p className="mb-3 text-xs text-muted">Loaded from {sourceLabel}</p>
          )}

          <label htmlFor="anki-input" className="mb-2 text-sm font-medium">
            Cards (tab-separated, editable)
          </label>
          <textarea
            id="anki-input"
            value={ankiText}
            onChange={e => setAnkiText(e.target.value)}
            rows={14}
            className="w-full flex-1 resize-y rounded-lg border border-border bg-panel px-3 py-2 font-mono text-sm outline-none focus:border-accent"
            placeholder="Country&#9;Capital&#9;Paris"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={loading || !ankiText.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
            >
              {loading ? "Generating…" : "Generate graph"}
            </button>
            {costUsd !== null && (
              <span className="text-xs text-muted">Cost: ${costUsd.toFixed(4)}</span>
            )}
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {savedGraphs.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-medium text-muted">Saved graphs</h2>
              <ul className="max-h-48 space-y-1 overflow-auto">
                {savedGraphs.map(g => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => void handleLoad(g.id)}
                      className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-white/5"
                    >
                      <span className="font-medium">{g.rootName}</span>
                      <span className="ml-2 text-muted">
                        {g.cardCount} cards · {new Date(g.createdAt).toLocaleString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Output panel */}
        <section className="flex min-h-[640px] flex-col p-6">
          {!graph ? (
            <div className="flex flex-1 items-center justify-center text-muted">
              Generate or load a graph to visualize
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{graph.root.name}</h2>
                  <p className="text-sm text-muted">
                    {graph.cardCount} cards · saved {new Date(graph.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-white/5"
                  >
                    Download JSON
                  </button>
                  <div className="flex rounded-md border border-border text-xs">
                    <button
                      type="button"
                      onClick={() => setTab("graph")}
                      className={`px-3 py-1.5 ${tab === "graph" ? "bg-white/10" : "hover:bg-white/5"}`}
                    >
                      Graph
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab("json")}
                      className={`px-3 py-1.5 ${tab === "json" ? "bg-white/10" : "hover:bg-white/5"}`}
                    >
                      JSON
                    </button>
                  </div>
                </div>
              </div>

              {tab === "graph" ? (
                <GraphCanvas key={graphKey} root={graph.root as TreeNode} />
              ) : (
                <pre className="flex-1 overflow-auto rounded-lg border border-border bg-panel p-4 font-mono text-xs">
                  {JSON.stringify(graph.root, null, 2)}
                </pre>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
