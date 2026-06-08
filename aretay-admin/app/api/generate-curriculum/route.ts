import { NextRequest, NextResponse } from "next/server";
import { OpenRouter } from "@openrouter/sdk";
import { buildCurriculumPrompt, parseCurriculumJson } from "@/lib/curriculum-prompt";
import type { Curriculum } from "@/lib/curriculum";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!title) {
    return NextResponse.json({ error: "Course name is required" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: "Description is required to define course scope" }, { status: 400 });
  }

  const openrouter = new OpenRouter({ apiKey });
  const prompt = buildCurriculumPrompt(title, description);

  try {
    const stream = await openrouter.chat.send({
      chatRequest: {
        model: "anthropic/claude-sonnet-4.6",
        messages: [{ role: "user", content: prompt }],
        stream: true,
      },
    });

    let response = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) response += content;
    }

    const parsed = parseCurriculumJson(response) as Curriculum;
    if (!parsed?.videos || !Array.isArray(parsed.videos)) {
      return NextResponse.json({ error: "Model returned invalid curriculum JSON" }, { status: 502 });
    }

    return NextResponse.json({ curriculum: parsed });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate curriculum";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
