import AdmZip from "adm-zip";
import Database from "better-sqlite3";
import { decompress } from "fzstd";

const FIELD_SEP = "\x1f";

type AnkiDeck = { id: number; name: string; noteCount: number };
type AnkiModel = { name?: string; flds: { name: string }[] };

export type ApkgExtractResult = {
  deckId: number;
  deckName: string;
  decks: AnkiDeck[];
  ankiText: string;
  noteCount: number;
};

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

function normalizeField(value: string): string {
  return stripHtml(value).replace(/\t/g, " ").replace(/\r?\n/g, " ").trim();
}

function openCollectionDb(zip: AdmZip): Database.Database {
  const entry21b = zip.getEntry("collection.anki21b");
  if (entry21b) {
    const dbBuffer = Buffer.from(decompress(entry21b.getData()));
    return new Database(dbBuffer, { readonly: true });
  }

  const entry21 = zip.getEntry("collection.anki21");
  if (entry21) {
    return new Database(entry21.getData(), { readonly: true });
  }

  const entry2 = zip.getEntry("collection.anki2");
  if (entry2) {
    return new Database(entry2.getData(), { readonly: true });
  }

  throw new Error("No collection database found in APKG");
}

function parseDecks(raw: string): Map<number, string> {
  const parsed = JSON.parse(raw) as Record<string, { name?: string }>;
  const map = new Map<number, string>();
  for (const [id, deck] of Object.entries(parsed)) {
    map.set(Number(id), deck.name ?? `Deck ${id}`);
  }
  return map;
}

function parseModels(raw: string): Map<number, AnkiModel> {
  const parsed = JSON.parse(raw) as Record<string, AnkiModel>;
  const map = new Map<number, AnkiModel>();
  for (const [id, model] of Object.entries(parsed)) {
    map.set(Number(id), model);
  }
  return map;
}

function noteToLine(flds: string, mid: number, models: Map<number, AnkiModel>): string {
  const fields = flds.split(FIELD_SEP).map(normalizeField).filter(Boolean);
  if (fields.length === 0) return "";

  const model = models.get(mid);
  if (!model?.flds?.length || model.flds.length === 1) {
    return fields.join("\t");
  }

  // Drop the front field when the note type is a classic Q/A pair — keeps geography-style exports compact.
  const isBasic = model.flds.length === 2 && /basic/i.test(model.name ?? "");
  const values = isBasic ? fields.slice(1) : fields;
  return values.join("\t");
}

export function extractApkg(buffer: Buffer, deckId?: number): ApkgExtractResult {
  const zip = new AdmZip(buffer);
  const db = openCollectionDb(zip);

  try {
    const col = db.prepare("SELECT decks, models FROM col").get() as {
      decks: string;
      models: string;
    };

    const deckNames = parseDecks(col.decks);
    const models = parseModels(col.models);

    const deckCounts = db
      .prepare(
        `SELECT c.did AS did, COUNT(DISTINCT n.id) AS noteCount
         FROM cards c
         JOIN notes n ON n.id = c.nid
         GROUP BY c.did
         ORDER BY noteCount DESC`,
      )
      .all() as { did: number; noteCount: number }[];

    const decks: AnkiDeck[] = deckCounts.map(row => ({
      id: row.did,
      name: deckNames.get(row.did) ?? `Deck ${row.did}`,
      noteCount: row.noteCount,
    }));

    const activeDeckId = deckId ?? decks[0]?.id;
    if (activeDeckId == null) {
      throw new Error("APKG contains no cards");
    }

    const notes = db
      .prepare(
        `SELECT DISTINCT n.flds, n.mid
         FROM notes n
         JOIN cards c ON c.nid = n.id
         WHERE c.did = ?
         ORDER BY n.id`,
      )
      .all(activeDeckId) as { flds: string; mid: number }[];

    const lines = notes.map(n => noteToLine(n.flds, n.mid, models)).filter(Boolean);
    const deckName = deckNames.get(activeDeckId) ?? `Deck ${activeDeckId}`;

    return {
      deckId: activeDeckId,
      deckName,
      decks,
      ankiText: lines.join("\n"),
      noteCount: lines.length,
    };
  } finally {
    db.close();
  }
}
