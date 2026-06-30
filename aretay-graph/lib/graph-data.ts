import type { TreeNode } from "./types";

const RESERVED_KEYS = new Set([
  "kind",
  "name",
  "q",
  "a",
  "fromDeck",
  "count",
  "type",
  "cards",
  "note",
  "children",
]);

export type NodeKind = "topic" | "question";

export type VizNode = {
  id: string;
  name: string;
  kind: NodeKind;
  fromDeck: boolean;
  q?: string;
  a?: string;
  type?: string;
  count?: number;
  note?: string;
  extras: Record<string, string>;
  val: number;
};

export type VizLink = {
  source: string;
  target: string;
};

export type VizGraphData = {
  nodes: VizNode[];
  links: VizLink[];
};

function nodeKind(node: TreeNode): NodeKind {
  if (node.kind === "topic" || node.kind === "question") return node.kind;
  // Fallback for older graphs that predate the topic/question split.
  return (node.children?.length ?? 0) > 0 ? "topic" : "question";
}

function extraFields(node: TreeNode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(node)) {
    if (RESERVED_KEYS.has(key) || value == null) continue;
    out[key] = String(value);
  }
  return out;
}

function walk(
  node: TreeNode,
  parentId: string | null,
  path: string,
  nodes: VizNode[],
  links: VizLink[],
): void {
  const kind = nodeKind(node);
  const q = typeof node.q === "string" ? node.q : undefined;
  const a = typeof node.a === "string" ? node.a : undefined;
  const label =
    kind === "question"
      ? (q ?? (typeof node.name === "string" ? node.name : "?"))
      : (typeof node.name === "string" ? node.name : (q ?? "?"));

  nodes.push({
    id: path,
    name: label,
    kind,
    fromDeck: node.fromDeck === true,
    q,
    a,
    type: node.type,
    count: node.count,
    note: node.note,
    extras: extraFields(node),
    val: kind === "topic" ? Math.max(4, Math.min(20, Math.sqrt(node.count ?? 1) * 2)) : 5,
  });

  if (parentId) {
    links.push({ source: parentId, target: path });
  }

  node.children?.forEach((child, index) => {
    walk(child, path, `${path}.${index}`, nodes, links);
  });
}

export function treeToGraphData(root: TreeNode): VizGraphData {
  const nodes: VizNode[] = [];
  const links: VizLink[] = [];
  walk(root, null, "0", nodes, links);
  return { nodes, links };
}

export function nodeColor(node: VizNode): string {
  if (node.kind === "topic") return "#6ea8ff"; // topics: blue
  return node.fromDeck ? "#7dcea0" : "#e0a458"; // deck question: green · invented question: amber
}
