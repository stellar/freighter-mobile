import { getThemeColors } from "config/colors";

describe("theme gray ramp", () => {
  // The shimmer pill fades between the page base and gray 5 and its hairline
  // sits on gray 6, in BOTH themes; the light ramp used to stop at 4.
  it.each([
    ["light", 5, "#e8e8e8"],
    ["light", 6, "#e2e2e2"],
    ["dark", 5, "#2e2e2e"],
    ["dark", 6, "#343434"],
  ] as const)("%s gray %i is %s", (scheme, step, hex) => {
    expect(getThemeColors(scheme).gray[step]).toBe(hex);
  });
});
