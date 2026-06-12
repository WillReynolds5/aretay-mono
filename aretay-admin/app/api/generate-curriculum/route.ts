import { NextRequest, NextResponse } from "next/server";
import { OpenRouter } from "@openrouter/sdk";
import { buildCurriculumPrompt, isValidCurriculum, parseCurriculumJson } from "@/lib/curriculum-prompt";
import type { Curriculum } from "@/lib/curriculum";
import { flattenScripts } from "@/lib/curriculum";
import { DEFAULT_CURRICULUM_MODEL, isCurriculumModel } from "@/lib/curriculum-models";

export const maxDuration = 300;

function extractContent(result: unknown): string {
  if (!result || typeof result !== "object") return "";

  const choices = (result as { choices?: unknown[] }).choices;
  const first = choices?.[0];
  if (!first || typeof first !== "object") return "";

  const message = (first as { message?: { content?: unknown } }).message;
  const content = message?.content;

  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === "object" && part && "text" in part ? String(part.text) : ""))
      .join("");
  }

  return "";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const model = isCurriculumModel(body.model) ? body.model : DEFAULT_CURRICULUM_MODEL;

  if (!name) {
    return NextResponse.json({ error: "Course name is required" }, { status: 400 });
  }

  const openrouter = new OpenRouter({ apiKey });
  const prompt = buildCurriculumPrompt(name);

  try {
    const result = await openrouter.chat.send({
      chatRequest: {
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        maxTokens: 65536,
      },
    });

    const response = extractContent(result);
    const parsed = parseCurriculumJson(response);
    if (!isValidCurriculum(parsed)) {
      return NextResponse.json({ error: "Model returned invalid curriculum JSON" }, { status: 502 });
    }

    const curriculum = parsed as Curriculum;
    const scriptCount = flattenScripts(curriculum).length;

    return NextResponse.json({
      curriculum,
      stats: {
        lessons: curriculum.lessons.length,
        scripts: scriptCount,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate curriculum";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
