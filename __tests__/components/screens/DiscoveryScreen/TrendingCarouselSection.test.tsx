import TrendingCarouselSection from "components/screens/DiscoveryScreen/components/TrendingCarouselSection";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { ReactTestInstance } from "react-test-renderer";

jest.mock("components/TrendingCarousel", () => ({
  TrendingCarousel: () => null,
}));

/**
 * The classes laid out on an element. NativeWind doesn't apply them in tests,
 * so they're read off the nearest component given them.
 */
const classesOf = (element: ReactTestInstance | null): string => {
  let node = element;
  while (node && typeof node.props.className !== "string") node = node.parent;
  return node?.props.className ?? "";
};

describe("TrendingCarouselSection", () => {
  // Trending opens Discover's list, so its title starts right under the nav
  // bar, with nothing to scroll past above it.
  it("sets its title flush with the top of the list", () => {
    const { getByLabelText } = renderWithProviders(
      <TrendingCarouselSection
        title="Trending"
        items={[{ id: "1" } as never]}
        onItemPress={jest.fn()}
      />,
    );
    const classes = classesOf(getByLabelText("Trending"));

    expect(classes).toContain("mb-3");
    expect(classes).not.toMatch(/\bmt-/);
  });
});
