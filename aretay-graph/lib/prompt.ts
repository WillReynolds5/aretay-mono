import fs from "fs";
import path from "path";

const PROMPT_PATH = path.join(process.cwd(), "prompt.txt");

export function buildPrompt(ankiText: string): string {
  const template = fs.readFileSync(PROMPT_PATH, "utf8");
  return template.replace("{{ANKI_TXT}}", ankiText.trim());
}
