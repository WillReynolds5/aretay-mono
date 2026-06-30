import { NextResponse } from "next/server";
import { generateGraph } from "@/lib/llm";
import { buildPrompt } from "@/lib/prompt";
import { saveGraph } from "@/lib/storage";
import type { TreeNode } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const { ankiText } = (await req.json()) as { ankiText?: string };
    if (!ankiText?.trim()) {
      return NextResponse.json({ error: "ankiText is required" }, { status: 400 });
    }

    const prompt = buildPrompt(ankiText);
    const { root, costUsd } = await generateGraph(prompt);
    const saved = saveGraph(root as TreeNode);

    return NextResponse.json({ ...saved, costUsd });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
