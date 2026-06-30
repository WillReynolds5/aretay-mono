import { NextResponse } from "next/server";
import { extractApkg } from "@/lib/apkg";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const deckIdRaw = form.get("deckId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".apkg")) {
      return NextResponse.json({ error: "Expected a .apkg file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const deckId = deckIdRaw ? Number(deckIdRaw) : undefined;
    const result = extractApkg(buffer, deckId);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to parse APKG";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
