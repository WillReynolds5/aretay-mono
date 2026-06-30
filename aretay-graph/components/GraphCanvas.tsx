"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { nodeColor, treeToGraphData } from "@/lib/graph-data";
import type { VizNode } from "@/lib/graph-data";
import type { TreeNode } from "@/lib/types";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type ForceGraphRef = {
  zoomToFit: (ms?: number, padding?: number) => void;
  d3ReheatSimulation: () => void;
};

export default function GraphCanvas({ root }: { root: TreeNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphRef | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [selected, setSelected] = useState<VizNode | null>(null);
  const [layoutKey, setLayoutKey] = useState(0);

  const graphData = useMemo(() => treeToGraphData(root), [root]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleEngineStop = useCallback(() => {
    graphRef.current?.zoomToFit(400, 40);
  }, []);

  const resetLayout = useCallback(() => {
    setSelected(null);
    setLayoutKey(k => k + 1);
  }, []);

  const fitView = useCallback(() => {
    graphRef.current?.zoomToFit(400, 40);
  }, []);

  return (
    <div className="flex min-h-[560px] flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>Drag nodes · scroll to zoom · click for details</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fitView}
            className="rounded-md border border-border px-2.5 py-1 hover:bg-white/5"
          >
            Fit view
          </button>
          <button
            type="button"
            onClick={resetLayout}
            className="rounded-md border border-border px-2.5 py-1 hover:bg-white/5"
          >
            Reset layout
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        <div
          ref={containerRef}
          className="relative min-h-[480px] flex-1 overflow-hidden rounded-lg border border-border bg-[#0a0c0f]"
        >
          <ForceGraph2D
            key={layoutKey}
            ref={graphRef as never}
            width={size.width}
            height={size.height}
            graphData={graphData}
            nodeId="id"
            nodeLabel="name"
            nodeVal="val"
            nodeColor={nodeColor as never}
            linkColor={() => "rgba(110, 168, 255, 0.35)"}
            linkDirectionalArrowLength={4}
            linkDirectionalArrowRelPos={1}
            linkWidth={1.2}
            backgroundColor="#0a0c0f"
            cooldownTicks={120}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
            onEngineStop={handleEngineStop}
            onNodeClick={(node: object) => setSelected(node as VizNode)}
            onBackgroundClick={() => setSelected(null)}
            nodeCanvasObject={(node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
              const n = node as VizNode & { x?: number; y?: number };
              if (n.x == null || n.y == null) return;

              const label = n.name;
              const fontSize = Math.max(10 / globalScale, 3);
              const radius = Math.sqrt(n.val) * 2.2;

              ctx.beginPath();
              ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
              ctx.fillStyle = nodeColor(n);
              ctx.fill();

              if (selected?.id === n.id) {
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 2 / globalScale;
                ctx.stroke();
              } else {
                ctx.strokeStyle = "rgba(255,255,255,0.15)";
                ctx.lineWidth = 1 / globalScale;
                ctx.stroke();
              }

              ctx.font = `${fontSize}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = "rgba(232, 237, 242, 0.9)";
              ctx.fillText(label, n.x, n.y + radius + 2 / globalScale);
            }}
            nodePointerAreaPaint={(node: object, color: string, ctx: CanvasRenderingContext2D) => {
              const n = node as VizNode & { x?: number; y?: number };
              if (n.x == null || n.y == null) return;
              const radius = Math.sqrt(n.val) * 2.2 + 2;
              ctx.beginPath();
              ctx.arc(n.x, n.y, radius, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
          />
        </div>

        <aside className="w-56 shrink-0 rounded-lg border border-border bg-panel p-3 text-sm">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Node</h3>
          {!selected ? (
            <p className="text-muted">Click a node to inspect it.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted">
                {selected.kind === "topic"
                  ? "Topic"
                  : selected.fromDeck
                    ? "Question · from deck"
                    : "Question · invented"}
              </p>
              {selected.kind === "question" ? (
                <>
                  <p className="font-semibold leading-snug">{selected.q ?? selected.name}</p>
                  {selected.a && (
                    <p>
                      <span className="text-muted">answer:</span> {selected.a}
                    </p>
                  )}
                </>
              ) : (
                <p className="font-semibold leading-snug">{selected.name}</p>
              )}
              {selected.type && (
                <p>
                  <span className="text-muted">type:</span> {selected.type}
                </p>
              )}
              {selected.kind === "topic" && typeof selected.count === "number" && (
                <p>
                  <span className="text-muted">questions:</span> {selected.count}
                </p>
              )}
              {Object.entries(selected.extras).map(([key, value]) => (
                <p key={key}>
                  <span className="text-muted">{key}:</span> {value}
                </p>
              ))}
              {selected.note && <p className="text-xs italic text-amber-400/90">{selected.note}</p>}
            </div>
          )}

          <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#6ea8ff]" />
              Topic
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#7dcea0]" />
              Question (from deck)
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#e0a458]" />
              Question (invented)
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
