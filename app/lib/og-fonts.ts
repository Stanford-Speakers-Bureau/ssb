import { readFile } from "node:fs/promises";
import { join } from "node:path";

// cache busted: switched to static TTF
let cachedHedvigSerif: ArrayBuffer | null = null;

export async function getHedvigSerif(): Promise<ArrayBuffer> {
  if (cachedHedvigSerif) return cachedHedvigSerif;
  const path = join(
    process.cwd(),
    "public",
    "fonts",
    "HedvigLettersSerif-Regular.ttf",
  );
  const buf = await readFile(path);
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
  cachedHedvigSerif = ab;
  return ab;
}
