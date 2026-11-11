import {
  SPLASH_TIMELINE,
  SPLASH_TOTAL_MS,
  getSplashProgress,
} from "components/SplashAnimation/splashTimeline";

const { revealDelayMs, revealDurationMs, holdMs, recolorDurationMs } =
  SPLASH_TIMELINE;

const revealEnd = revealDelayMs + revealDurationMs;
const recolorStart = revealEnd + holdMs;

describe("getSplashProgress", () => {
  it("shows nothing before the reveal starts", () => {
    expect(getSplashProgress(0)).toEqual({ reveal: 0, recolor: 0 });
  });

  it("starts the wipe immediately, with no lead-in", () => {
    expect(getSplashProgress(1).reveal).toBeGreaterThan(0);
  });

  it("reports the reveal half done at the midpoint", () => {
    expect(getSplashProgress(revealDelayMs + revealDurationMs / 2).reveal).toBe(
      0.5,
    );
  });

  it("completes the reveal before any recolouring starts", () => {
    expect(getSplashProgress(revealEnd)).toEqual({ reveal: 1, recolor: 0 });
  });

  it("holds the grey logomark after the reveal", () => {
    expect(getSplashProgress(revealEnd + holdMs / 2)).toEqual({
      reveal: 1,
      recolor: 0,
    });
  });

  it("reports the recolour half done at its midpoint", () => {
    expect(
      getSplashProgress(recolorStart + recolorDurationMs / 2).recolor,
    ).toBe(0.5);
  });

  it("finishes both tracks at the end of the timeline", () => {
    expect(getSplashProgress(SPLASH_TOTAL_MS)).toEqual({
      reveal: 1,
      recolor: 1,
    });
  });

  it("rests on the final form before the timeline ends", () => {
    // The exit is scheduled at SPLASH_TOTAL_MS, so the lockup only dwells in
    // its finished state if the timeline runs past the recolour.
    expect(getSplashProgress(SPLASH_TOTAL_MS - 1)).toEqual({
      reveal: 1,
      recolor: 1,
    });
  });

  it("clamps past the end so a slow start never rewinds", () => {
    expect(getSplashProgress(SPLASH_TOTAL_MS * 10)).toEqual({
      reveal: 1,
      recolor: 1,
    });
  });

  it("clamps negative elapsed time to the start", () => {
    expect(getSplashProgress(-500)).toEqual({ reveal: 0, recolor: 0 });
  });
});
