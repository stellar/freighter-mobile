import { getScrollCueTargetY } from "components/screens/EthenaLaunchScreen/scrollCue";
import { pxValue } from "helpers/dimensions";

describe("getScrollCueTargetY", () => {
  it("rests the cue 20pt below the bar", () => {
    // A cue at 760 under a bar 104 tall: scrolled by the result, the cue sits
    // at 104 + 20 from the top of the screen.
    expect(getScrollCueTargetY(760, 104)).toBe(760 - 104 - pxValue(20));
  });

  it("never scrolls above the top", () => {
    expect(getScrollCueTargetY(100, 104)).toBe(0);
  });
});
