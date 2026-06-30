import fs from "fs";
import path from "path";
import type { GraphListItem, SavedGraph, TreeNode } from "./types";

const OUTPUT_DIR = path.join(process.cwd(), "output");

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

export function countLeaves(node: TreeNode): number {
  if (node.children?.length) {
    return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
  }
  return node.fromDeck === false ? 0 : 1;
}

export function saveGraph(root: TreeNode): SavedGraph {
  ensureOutputDir();
  const id = new Date().toISOString().replace(/[:.]/g, "-");
  const saved: SavedGraph = {
    id,
    createdAt: new Date().toISOString(),
    cardCount: countLeaves(root),
    root,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, `${id}.json`), JSON.stringify(saved, null, 2));
  return saved;
}

export function listGraphs(): GraphListItem[] {
  ensureOutputDir();
  return fs
    .readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const raw = fs.readFileSync(path.join(OUTPUT_DIR, f), "utf8");
      const saved = JSON.parse(raw) as SavedGraph;
      return {
        id: saved.id,
        createdAt: saved.createdAt,
        cardCount: saved.cardCount,
        rootName: saved.root.name,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadGraph(id: string): SavedGraph {
  ensureOutputDir();
  const safeId = path.basename(id);
  const filePath = path.join(OUTPUT_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) throw new Error("Graph not found");
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as SavedGraph;
}
