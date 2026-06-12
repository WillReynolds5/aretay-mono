// Client-safe (no SDK imports) — shared by the new-course page and the
// generate-curriculum API route.

export const CURRICULUM_MODELS = [
  "anthropic/claude-fable-5",
  "anthropic/claude-opus-4.8-fast",
  "anthropic/claude-sonnet-4.6",
  "google/gemini-3.1-pro-preview",
  "openai/gpt-5.5",
] as const;

export type CurriculumModel = (typeof CURRICULUM_MODELS)[number];

export const DEFAULT_CURRICULUM_MODEL: CurriculumModel = "anthropic/claude-fable-5";

export function isCurriculumModel(value: unknown): value is CurriculumModel {
  return typeof value === "string" && (CURRICULUM_MODELS as readonly string[]).includes(value);
}
