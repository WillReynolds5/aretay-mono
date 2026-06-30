import { NextResponse } from "next/server";
import { loadGraph } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json(loadGraph(id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load graph";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
