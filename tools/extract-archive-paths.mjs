// One-shot script: extracts Great Vibes glyph outlines for "The Archive"
// and emits a TS module. Delete after use.
import opentype from "opentype.js";
import { writeFileSync } from "node:fs";

const FONT_URL =
  "https://raw.githubusercontent.com/google/fonts/main/ofl/greatvibes/GreatVibes-Regular.ttf";
const OUT = new URL(
  "../app/past-speakers/components/archive-title-paths.ts",
  import.meta.url,
);

const TEXT = "The Archive";
const FONT_SIZE = 220;
const VIEWBOX_W = 1400;
const VIEWBOX_H = 310;
const BASELINE_Y = 215;

const res = await fetch(FONT_URL);
if (!res.ok) throw new Error(`font fetch failed: ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
const font = opentype.parse(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
);

// Measure full text width so we can center it
const fullWidth = font.getAdvanceWidth(TEXT, FONT_SIZE);
const startX = (VIEWBOX_W - fullWidth) / 2;

// Per-character paths so we can animate each separately, in writing order.
// Compute approximate path length per glyph from its commands so we can
// time each character's draw proportional to its complexity.
function pathLengthEstimate(commands) {
  let total = 0;
  let cx = 0,
    cy = 0,
    sx = 0,
    sy = 0;
  for (const c of commands) {
    if (c.type === "M") {
      cx = c.x;
      cy = c.y;
      sx = cx;
      sy = cy;
    } else if (c.type === "L") {
      total += Math.hypot(c.x - cx, c.y - cy);
      cx = c.x;
      cy = c.y;
    } else if (c.type === "C") {
      const dx = c.x - cx,
        dy = c.y - cy;
      total += Math.hypot(dx, dy) * 1.05;
      cx = c.x;
      cy = c.y;
    } else if (c.type === "Q") {
      const dx = c.x - cx,
        dy = c.y - cy;
      total += Math.hypot(dx, dy) * 1.03;
      cx = c.x;
      cy = c.y;
    } else if (c.type === "Z") {
      total += Math.hypot(sx - cx, sy - cy);
      cx = sx;
      cy = sy;
    }
  }
  return total;
}

let cursorX = startX;
const entries = [];
for (let i = 0; i < TEXT.length; i++) {
  const ch = TEXT[i];
  if (ch === " ") {
    cursorX += font.getAdvanceWidth(" ", FONT_SIZE);
    continue;
  }
  const glyph = font.charToGlyph(ch);
  const path = glyph.getPath(cursorX, BASELINE_Y, FONT_SIZE);
  // Strip zero-length L segments that opentype emits right after each M.
  // These render as visible dots at pathLength=0 because of round linecaps.
  const cleaned = [];
  let lastX = 0,
    lastY = 0;
  for (const c of path.commands) {
    if (c.type === "M") {
      cleaned.push(c);
      lastX = c.x;
      lastY = c.y;
    } else if (
      c.type === "L" &&
      Math.abs(c.x - lastX) < 0.01 &&
      Math.abs(c.y - lastY) < 0.01
    ) {
      // skip degenerate
    } else {
      cleaned.push(c);
      if ("x" in c && "y" in c) {
        lastX = c.x;
        lastY = c.y;
      }
    }
  }
  path.commands = cleaned;
  const d = path.toPathData(2);
  const len = pathLengthEstimate(path.commands);
  cursorX += glyph.advanceWidth * (FONT_SIZE / font.unitsPerEm);
  entries.push({ name: `glyph-${i}-${ch}`, ch, d, len });
}

// Timing: durations proportional to perimeter length so visual draw speed
// stays roughly constant across letters. Slight overlap between adjacent
// glyphs keeps the flow continuous (pen-like) instead of discrete.
const TOTAL = 2.4;
const totalLen = entries.reduce((a, e) => a + e.len, 0);
let runningDelay = 0;
const stamped = entries.map((e) => {
  const frac = e.len / totalLen;
  const dur = +(TOTAL * frac * 1.18).toFixed(3);
  const delay = +runningDelay.toFixed(3);
  runningDelay += TOTAL * frac * 0.85;
  const isCap = e.ch === e.ch.toUpperCase() && e.ch !== e.ch.toLowerCase();
  return {
    name: e.name,
    d: e.d,
    delay,
    duration: dur,
    width: isCap ? 2.6 : 2.2,
  };
});

const ts = `// Generated from Great Vibes glyph outlines for "The Archive".
// Each entry is one character's outline path; animation traces the outline.
export const ARCHIVE_TITLE_PATHS = [
${stamped
  .map(
    (s) =>
      `  {\n    name: ${JSON.stringify(s.name)},\n    d: ${JSON.stringify(s.d)},\n    delay: ${s.delay},\n    duration: ${s.duration},\n    width: ${s.width},\n  },`,
  )
  .join("\n")}
] as const;
`;

writeFileSync(OUT, ts);
console.log(`wrote ${OUT.pathname} (${stamped.length} entries)`);
