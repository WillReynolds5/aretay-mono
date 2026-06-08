export function buildCurriculumPrompt(title: string, scope: string, lessonCount = 18) {
  return `# Cinematic History Course → JSON Generator

Paste everything below the line into a capable LLM. It will output a complete course as a single JSON object. Edit the **CONFIGURATION** block to generate a different course.

---

## CONFIGURATION

- **COURSE_TITLE:** \`${title}\`
- **SCOPE:** ${scope}
- **NUMBER_OF_LESSONS:** \`${lessonCount}\`
- **GRANULARITY:** Each lesson is one landmark, dated fact (a founding, a battle, a death, a turning point). Zoomed-out, not detailed.
- **DATE_STYLE:** Use \`BC\` / \`AD\`.
- **NARRATION_VOICE:** Calm and authoritative male voice.
- **NARRATION_LENGTH:** ~40–55 spoken words (about 15–20 seconds).

---

## ROLE

You are a course generator that produces cinematic, AI-video-ready history lessons. You output **only** machine-readable JSON — no prose, no explanations.

## OUTPUT FORMAT (STRICT)

- Output **only** a single valid JSON object. No markdown, no code fences, no commentary before or after.
- Use straight double quotes for all JSON keys and strings. Escape any double quotes that appear *inside* a string value with \`\\"\`.
- The em dash \`—\` is allowed inside string values.
- Produce exactly **NUMBER_OF_LESSONS** items in the \`videos\` array, ordered chronologically by date.

## JSON SCHEMA

\`\`\`json
{
  "title": "string — the COURSE_TITLE",
  "videos": [
    {
      "id": "integer — sequential, starting at 1",
      "title": "string — short lesson name, e.g. 'The Founding of Rome'",
      "date": "string — e.g. '753 BC' or '80 AD'",
      "era": "string — the part/section this lesson belongs to, e.g. 'Ancient Greece'",
      "prompt": "string — the FULL cinematic video prompt (see PROMPT FIELD spec). Includes the narration embedded inside it.",
      "narration": "string — the spoken script ONLY, extracted verbatim from the prompt, for use in text-to-speech and captions.",
      "question": {
        "text": "string — one multiple-choice question; may combine facts, e.g. who + when",
        "options": ["string (max 3 words)", "string (max 3 words)", "string (max 3 words)", "string (max 3 words)"],
        "answer": "string — max 3 words; must exactly match one of the options"
      }
    }
  ]
}
\`\`\`

## PROMPT FIELD — required structure

Each \`prompt\` string must contain these parts, in this order, as one continuous string:

1. **Shot + setting:** A camera shot type and movement (e.g. "Cinematic aerial shot slowly descending"), the setting, and the date.
2. **Scene:** Vivid, photorealistic visual detail — key figures, action, atmosphere, lighting, and a camera move that builds (push-in, crane, dive, etc.).
3. **Narration tag + script:** The literal phrase \`Audio narration, calm and authoritative male voice:\` followed by the narration in escaped double quotes (\`\\"...\\"\`).
4. **Score + style tags:** \`Epic orchestral score underneath, swelling as narration ends.\` then scene-appropriate technical tags such as \`Cinematic, photorealistic, 4K,\` plus lighting and detail descriptors.

## STYLE RULES

- **Visuals:** Each scene must be distinct — vary camera angles, lighting, and composition across lessons so the series doesn't feel repetitive.
- **Narration:** Punchy, dramatic, trailer-style cadence. Short declarative sentences. Lead with the date. End on a memorable line.
- **Questions:** Exactly one question per lesson. A question may combine facts (e.g. who AND when — "Who founded Rome, and in what year?"). Provide exactly 4 options. Only one is correct.
- **Short answers (MAX 3 WORDS):** Every option — including the correct answer — must be at most 3 words. A year counts as a single word (e.g. "753 BC" counts as one word, so "Romulus, 753 BC" is two words). Keep all four options in the same short format and structure so the correct answer never stands out by length or shape.
- **Answer position MUST vary:** Distribute correct answers roughly evenly across the four positions throughout the course. Do **not** make the correct answer the first option every time.
- **Distractors:** Wrong options should be plausible (other dates, other figures, other events from the same course) — not absurd.

## WORKED EXAMPLE (one object, for style reference only — do not copy verbatim)

\`\`\`json
{
  "id": 9,
  "title": "The Founding of Rome",
  "date": "753 BC",
  "era": "The Roman Republic",
  "prompt": "Cinematic aerial shot slowly descending over ancient rolling hills at golden hour, 753 BC. Seven hills rise above the shimmering Tiber river winding through an untamed landscape. A lone figure — Romulus — stands on the highest hill, arms raised, silhouetted against a blazing orange and crimson sky. Primitive stone walls are being laid around him. Torches flicker along the perimeter. Eagles circle overhead. The camera slowly pushes in as light intensifies around him. Audio narration, calm and authoritative male voice: \\"In 753 BC, on the banks of the Tiber River, a man named Romulus drew a line in the earth. That line became a wall. That wall became a city. And that city — Rome — would go on to shape the entire course of Western civilization. April 21st, 753 BC. The day history began.\\" Epic orchestral score underneath, swelling as narration ends. Cinematic, photorealistic, 4K, dramatic god rays, hyper-detailed ancient landscape.",
  "narration": "In 753 BC, on the banks of the Tiber River, a man named Romulus drew a line in the earth. That line became a wall. That wall became a city. And that city — Rome — would go on to shape the entire course of Western civilization. April 21st, 753 BC. The day history began.",
  "question": {
    "text": "Who founded Rome, and in what year?",
    "options": ["Aeneas, 509 BC", "Romulus, 753 BC", "Caesar, 44 BC", "Numa, 700 BC"],
    "answer": "Romulus, 753 BC"
  }
}
\`\`\`

## FINAL CHECKLIST (verify before output)

1. Output is a single valid JSON object and nothing else.
2. \`videos\` has exactly NUMBER_OF_LESSONS items, ordered by date.
3. Every \`prompt\` follows the 4-part structure and embeds its narration.
4. Every \`narration\` matches the script inside its \`prompt\` exactly.
5. Every \`question\` has 4 options and an \`answer\` that matches one option.
6. Every option (and the answer) is at most 3 words, all in the same short format.
7. Correct answers are spread across all four positions — not always first.

Now generate the course defined in CONFIGURATION.`;
}

export function parseCurriculumJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : trimmed;
  return JSON.parse(jsonText);
}
