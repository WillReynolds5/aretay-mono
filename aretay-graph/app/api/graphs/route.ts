import { NextResponse } from "next/server";
import { listGraphs } from "@/lib/storage";

export async function GET() {
  try {
    return NextResponse.json({ graphs: listGraphs() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list graphs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
