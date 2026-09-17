import fs from "fs";
import path from "path";

/**
 * Minimal TrueType reader: enough to answer "how wide is this string, in em".
 *
 * Test-only. It imports `fs`, which Metro cannot resolve, so it lives under
 * `__tests__/support` rather than `src/helpers` — from there an accidental
 * import by a component would break the bundle.
 *
 * The alternative was a transcribed table of advance widths, which a reviewer
 * correctly called out as unfalsifiable — an Inter version bump or a weight
 * change leaves it quietly wrong and the guard green. Reading the shipped
 * `.ttf` means the numbers cannot drift from what the app renders.
 *
 * Parses only `head` (unitsPerEm), `hhea`/`hmtx` (advances) and a format 4
 * `cmap` subtable, which is all Inter needs for the Latin range.
 */

interface Font {
  unitsPerEm: number;
  advance: (codePoint: number) => number | undefined;
}

const TAG = (view: DataView, offset: number) =>
  String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );

/** The spec stores these sums "modulo 65536"; this says so without bit-twiddling. */
const uint16 = (value: number) => ((value % 65536) + 65536) % 65536;

/** Unicode code point to glyph id, via a format 4 segment-mapping subtable. */
const parseCmap4 = (view: DataView, base: number) => {
  const segCount = view.getUint16(base + 6) / 2;
  const endBase = base + 14;
  const startBase = endBase + segCount * 2 + 2;
  const deltaBase = startBase + segCount * 2;
  const rangeBase = deltaBase + segCount * 2;

  return (codePoint: number): number => {
    for (let seg = 0; seg < segCount; seg += 1) {
      // Segments are sorted, so the first one ending at or after the code
      // point is the only one that can contain it.
      if (codePoint <= view.getUint16(endBase + seg * 2)) {
        const start = view.getUint16(startBase + seg * 2);
        if (codePoint < start) return 0;

        const rangeOffset = view.getUint16(rangeBase + seg * 2);
        const delta = view.getInt16(deltaBase + seg * 2);
        if (rangeOffset === 0) return uint16(codePoint + delta);

        const glyphAt =
          rangeBase + seg * 2 + rangeOffset + (codePoint - start) * 2;
        const glyph = view.getUint16(glyphAt);
        return glyph === 0 ? 0 : uint16(glyph + delta);
      }
    }
    return 0;
  };
};

export const readFont = (file: string): Font => {
  const buffer = fs.readFileSync(file);
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );

  const tables: Record<string, number> = {};
  const tableCount = view.getUint16(4);
  for (let i = 0; i < tableCount; i += 1) {
    const record = 12 + i * 16;
    tables[TAG(view, record)] = view.getUint32(record + 8);
  }

  (["head", "hhea", "hmtx", "cmap"] as const).forEach((table) => {
    if (tables[table] === undefined) {
      // Without this the offset is NaN, DataView coerces it to 0, and every
      // measurement silently comes back as whatever bytes sit at the top of
      // the file — the exact unfalsifiable failure this reader exists to avoid.
      throw new Error(`${file}: missing required "${table}" table`);
    }
  });

  const unitsPerEm = view.getUint16(tables.head + 18);
  const hMetricCount = view.getUint16(tables.hhea + 34);
  const advanceOf = (glyph: number) =>
    view.getUint16(tables.hmtx + Math.min(glyph, hMetricCount - 1) * 4);

  // Prefer a Windows BMP (3,1) format 4 subtable; fall back to any format 4.
  const { cmap } = tables;
  let lookup: ((codePoint: number) => number) | undefined;
  const subtableCount = view.getUint16(cmap + 2);
  for (let i = 0; i < subtableCount; i += 1) {
    const record = cmap + 4 + i * 8;
    const subtable = cmap + view.getUint32(record + 4);
    if (view.getUint16(subtable) === 4) {
      lookup = parseCmap4(view, subtable);
      if (view.getUint16(record) === 3 && view.getUint16(record + 2) === 1) {
        break;
      }
    }
  }
  if (!lookup) throw new Error(`${file}: no format 4 cmap subtable`);

  const resolve = lookup;
  return {
    unitsPerEm,
    advance: (codePoint: number) => {
      const glyph = resolve(codePoint);
      return glyph === 0 ? undefined : advanceOf(glyph);
    },
  };
};

/**
 * Width of `text` as a multiple of its own font size. Throws on a character
 * the font has no glyph for, so an unrenderable label fails loudly rather
 * than measuring as zero.
 */
export const widthInEm = (font: Font, text: string): number =>
  [...text].reduce((total, char) => {
    const advance = font.advance(char.codePointAt(0)!);
    if (advance === undefined) {
      throw new Error(`no glyph for ${JSON.stringify(char)} in this font`);
    }
    return total + advance / font.unitsPerEm;
  }, 0);

/** Where the app's fonts live, resolved from here rather than the cwd. */
const FONT_DIR = path.join(__dirname, "../../src/assets/fonts");

/** Reads one of the bundled Inter faces by filename. */
export const readBundledFont = (file: string) =>
  readFont(path.join(FONT_DIR, file));
