const FONT_PUBLIC_PATH = "/fonts/HedvigLettersSerif-Regular.ttf";

let cachedHedvigSerif: ArrayBuffer | null = null;

export async function getHedvigSerif(): Promise<ArrayBuffer> {
  if (cachedHedvigSerif) return cachedHedvigSerif;
  const ab = (await loadFromFs()) ?? (await loadFromFetch());
  cachedHedvigSerif = ab;
  return ab;
}

async function loadFromFs(): Promise<ArrayBuffer | null> {
  try {
    const [{ readFile }, { join }] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    const path = join(process.cwd(), "public", FONT_PUBLIC_PATH);
    const buf = await readFile(path);
    return buf.buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    ) as ArrayBuffer;
  } catch {
    return null;
  }
}

async function loadFromFetch(): Promise<ArrayBuffer> {
  const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const res = await fetch(`${baseURL}${FONT_PUBLIC_PATH}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch font: ${res.status} ${res.statusText}`);
  }
  return await res.arrayBuffer();
}
