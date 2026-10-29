import { readFileSync } from "fs";
import { join } from "path";

/**
 * The tab bar's filled glyphs: Home's house, and Discover's compass while its
 * tab is selected. History's clock stays stroked. Figma draws them on a
 * 28-unit grid. They paint in currentColor, which Icon's `color` sets, so they
 * follow the scheme; the black and #E4E4E4 fills in Figma's export would not.
 * They carry no stroke, which would outline them in that same colour.
 */
const FILLED_ICONS = ["home-filled", "compass-03-filled"];

const readIcon = (name: string) =>
  readFileSync(
    join(__dirname, "../../src/assets/icons", `${name}.svg`),
    "utf8",
  );

const pathTags = (source: string) => source.match(/<path\b[^>]*>/g) ?? [];

describe.each(FILLED_ICONS)("%s.svg", (name) => {
  const source = readIcon(name);

  it("is drawn on Figma's 28-unit grid", () => {
    expect(source).toMatch(/^<svg[^>]*\sviewBox="0 0 28 28"[^>]*>/);
  });

  it("fills every path in currentColor", () => {
    const paths = pathTags(source);

    expect(paths.length).toBeGreaterThan(0);
    paths.forEach((tag) => expect(tag).toMatch(/\sfill="currentColor"/));
  });

  it("has no stroke", () => {
    expect(source).not.toMatch(/\sstroke[\w-]*=/);
  });
});

describe("compass-03-filled.svg", () => {
  const paths = pathTags(readIcon("compass-03-filled"));
  const [tag = ""] = paths;

  it("is a single path, so the needle can be cut out of the circle", () => {
    expect(paths).toHaveLength(1);
  });

  it("fills that path with the even-odd rule", () => {
    expect(tag).toMatch(/\sfill-rule="evenodd"/);
  });

  it("holds the circle and the needle as two closed subpaths", () => {
    // Even-odd only cuts a hole where a second closed shape sits inside the
    // first; a lone circle would pass the checks above and fill solid.
    const d = /\sd="([^"]*)"/.exec(tag)?.[1] ?? "";

    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/Z/g)).toHaveLength(2);
  });
});
