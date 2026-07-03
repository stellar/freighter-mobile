import { calculateScrollableMaxHeight } from "helpers/bottomSheet";

describe("calculateScrollableMaxHeight", () => {
  it("removes reservedVerticalPx from the window height before applying the ratio", () => {
    const base = calculateScrollableMaxHeight({ headerHeightPx: 40 });
    const reserved = calculateScrollableMaxHeight({
      headerHeightPx: 40,
      reservedVerticalPx: 50,
    });

    // reservedVerticalPx is subtracted from the window height before the
    // 0.9 ratio, so the budget drops by reservedVerticalPx * ratio. This
    // mirrors gorhom reducing a modal sheet's container height by its
    // bottom inset, keeping scroll content sized to the actual card.
    expect(base - reserved).toBeCloseTo(50 * 0.9, 5);
  });

  it("defaults reservedVerticalPx to 0 (no reduction)", () => {
    expect(calculateScrollableMaxHeight({ headerHeightPx: 40 })).toBe(
      calculateScrollableMaxHeight({
        headerHeightPx: 40,
        reservedVerticalPx: 0,
      }),
    );
  });
});
