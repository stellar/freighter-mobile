import { readFileSync } from "fs";
import { join } from "path";

/**
 * Icon's strokeWidth reaches an SVG's stroke only when the file sets its
 * stroke width on the root <svg>: svgr spreads props onto the root, and a
 * width set on a <path> would win over it. These are the icons whose stroke
 * the Varial header, onboarding and Home screens set.
 */
const ICONS_WITH_ROOT_STROKE = [
  "arrow-left",
  "x",
  "check",
  "check-circle",
  "copy-01",
  "eye",
  "eye-off",
  "clock-rewind",
  "compass-03",
  "chevron-down",
  "chevron-up",
  "plus",
  "arrow-up",
  "refresh-cw-02",
];

describe.each(ICONS_WITH_ROOT_STROKE)("%s.svg", (name) => {
  const source = readFileSync(
    join(__dirname, "../../src/assets/icons", `${name}.svg`),
    "utf8",
  );

  it("sets its stroke width on the root <svg>", () => {
    expect(source).toMatch(/^<svg[^>]*\sstroke-width="2"[^>]*>/);
  });

  it("leaves the stroke width off its paths", () => {
    expect(source).not.toMatch(/<path[^>]*stroke-width=/);
  });
});
