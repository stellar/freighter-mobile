import {
  cubicBezier,
  sparklePoseAt,
} from "components/WalletSetupOverlay/sparkleMotion";

// Expected values come from Figma's keyframes (Group 19, nodes 650:6177 and
// 2091:41732), worked out by hand.
describe("sparklePoseAt", () => {
  it("starts 6pt left of center, at rest scale", () => {
    expect(sparklePoseAt(0)).toEqual({
      translateX: -6,
      translateY: 0,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it("moves linearly between translation keyframes", () => {
    // 90% of the way from (-6, 0) at 0 to (-5.512, -3.711) at 0.06667.
    const pose = sparklePoseAt(0.06);

    expect(pose.translateX).toBeCloseTo(-5.5608, 3);
    expect(pose.translateY).toBeCloseTo(-3.3399, 3);
  });

  it("peaks 5pt up in the first hop", () => {
    expect(sparklePoseAt(0.12).translateY).toBeCloseTo(-5, 6);
  });

  it("lands each hop on the baseline, squashed", () => {
    expect(sparklePoseAt(0.24).translateY).toBeCloseTo(0, 6);
    expect(sparklePoseAt(0.24).scaleX).toBeCloseTo(1.06, 6);
    expect(sparklePoseAt(0.24).scaleY).toBeCloseTo(0.94, 6);

    expect(sparklePoseAt(0.45333).translateY).toBeCloseTo(0, 6);
    expect(sparklePoseAt(0.45333).scaleX).toBeCloseTo(1.04, 6);

    expect(sparklePoseAt(0.62667).translateY).toBeCloseTo(0, 6);
  });

  it("eases between scale keyframes", () => {
    // Halfway from 1 to 0.96 on an ease-out curve, (0, 0, 0.58, 1), is
    // 68.5% of the way, not the linear 50% (0.98).
    expect(sparklePoseAt(0.03).scaleX).toBeCloseTo(0.9726, 3);
  });

  it("rests at the center", () => {
    const rest = { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1 };

    [0.75, 0.8].forEach((progress) => {
      const pose = sparklePoseAt(progress);
      expect(pose.translateX).toBeCloseTo(rest.translateX, 6);
      expect(pose.translateY).toBeCloseTo(rest.translateY, 6);
      expect(pose.scaleX).toBeCloseTo(rest.scaleX, 6);
      expect(pose.scaleY).toBeCloseTo(rest.scaleY, 6);
    });
  });

  // Figma's loop ends at the center and starts 6pt left, so as drawn it
  // jumps back every loop. It slides back instead, in the rest's last 0.3s.
  it("slides back to the start during the rest", () => {
    const pose = sparklePoseAt(0.9);

    expect(pose.translateX).toBeCloseTo(-3, 6);
    expect(pose.translateY).toBeCloseTo(0, 6);
  });

  it("loops without a jump", () => {
    const start = sparklePoseAt(0);
    const end = sparklePoseAt(1);

    expect(end.translateX).toBeCloseTo(start.translateX, 9);
    expect(end.translateY).toBeCloseTo(start.translateY, 9);
    expect(end.scaleX).toBeCloseTo(start.scaleX, 9);
    expect(end.scaleY).toBeCloseTo(start.scaleY, 9);
  });

  it("clamps progress outside [0, 1] to the loop's ends", () => {
    expect(sparklePoseAt(-0.5)).toEqual(sparklePoseAt(0));
    expect(sparklePoseAt(1.5).translateX).toBeCloseTo(-6, 9);
  });
});

describe("cubicBezier", () => {
  it("passes through its endpoints", () => {
    const easeInOut = cubicBezier(0.42, 0, 0.58, 1);

    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
  });

  it("is symmetric for ease-in-out", () => {
    expect(cubicBezier(0.42, 0, 0.58, 1)(0.5)).toBeCloseTo(0.5, 3);
  });

  it("matches CSS ease-out at its midpoint", () => {
    // x(t) = 0.5 at t ≈ 0.6258, where y(t) ≈ 0.6847.
    expect(cubicBezier(0, 0, 0.58, 1)(0.5)).toBeCloseTo(0.6847, 3);
  });
});
