import { OpenRouter } from "@openrouter/sdk";

export const GRAPH_MODEL = "google/gemini-3.5-flash";

export function getOpenRouter(): OpenRouter {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  return new OpenRouter({ apiKey });
}

export function extractContent(result: unknown): string {
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

export function parseJsonResponse(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("LLM response contained no JSON object");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function generateGraph(prompt: string): Promise<{ root: unknown; costUsd: number }> {
  const openrouter = getOpenRouter();
  const result = await openrouter.chat.send({
    chatRequest: {
      model: GRAPH_MODEL,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      maxTokens: 65536,
    },
  });

  const text = extractContent(result).trim();
  if (!text) throw new Error("LLM returned an empty response");

  const usage = (result as { usage?: { cost?: number | null } } | null)?.usage;
  const costUsd = typeof usage?.cost === "number" ? usage.cost : 0;

  return { root: parseJsonResponse(text), costUsd };
}
