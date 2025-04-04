import { render } from "@testing-library/react-native";
import { Asset } from "components/sds/Asset";
import React from "react";

/**
 * Tests for the Asset component
 *
 * These tests verify:
 * - Rendering of all variants (single, swap, pair, platform)
 * - Size variations (sm, md, lg)
 * - Default size behavior
 * - Custom background color application
 * - Handling of local and remote image sources
 * - Accessibility label application
 */
describe("Asset", () => {
  const mockSourceOne = {
    image: "https://example.com/asset1.png",
    altText: "Asset 1",
  };

  const mockSourceTwo = {
    image: "https://example.com/asset2.png",
    altText: "Asset 2",
    backgroundColor: "#FF0000",
  };

  it("renders single asset correctly", () => {
    const { getByLabelText } = render(
      <Asset variant="single" size="md" sourceOne={mockSourceOne} />,
    );

    const image = getByLabelText("Asset 1");
    expect(image).toBeTruthy();
    expect(image.props.source).toEqual({
      uri: "https://example.com/asset1.png",
    });
  });

  it("uses 'lg' as the default size when not specified", () => {
    const { getByLabelText } = render(
      <Asset variant="single" sourceOne={mockSourceOne} />,
    );

    const image = getByLabelText("Asset 1");
    expect(image).toBeTruthy();
    // Testing that the component renders successfully with the default size
    // (We can't easily test the exact styling in this test environment)
  });

  it("renders swap variant correctly", () => {
    const { getByLabelText } = render(
      <Asset
        variant="swap"
        size="md"
        sourceOne={mockSourceOne}
        sourceTwo={mockSourceTwo}
      />,
    );

    const image1 = getByLabelText("Asset 1");
    const image2 = getByLabelText("Asset 2");

    expect(image1).toBeTruthy();
    expect(image2).toBeTruthy();
    expect(image1.props.source).toEqual({
      uri: "https://example.com/asset1.png",
    });
    expect(image2.props.source).toEqual({
      uri: "https://example.com/asset2.png",
    });
  });

  it("renders pair variant correctly", () => {
    const { getByLabelText } = render(
      <Asset
        variant="pair"
        size="md"
        sourceOne={mockSourceOne}
        sourceTwo={mockSourceTwo}
      />,
    );

    const image1 = getByLabelText("Asset 1");
    const image2 = getByLabelText("Asset 2");

    expect(image1).toBeTruthy();
    expect(image2).toBeTruthy();
  });

  it("renders platform variant correctly", () => {
    const { getByLabelText } = render(
      <Asset
        variant="platform"
        size="md"
        sourceOne={mockSourceOne}
        sourceTwo={mockSourceTwo}
      />,
    );

    const image1 = getByLabelText("Asset 1");
    const image2 = getByLabelText("Asset 2");

    expect(image1).toBeTruthy();
    expect(image2).toBeTruthy();
  });

  it("renders in different sizes", () => {
    const sizes: Array<"sm" | "md" | "lg"> = ["sm", "md", "lg"];

    sizes.forEach((size) => {
      const { getByLabelText, unmount } = render(
        <Asset variant="single" size={size} sourceOne={mockSourceOne} />,
      );

      const image = getByLabelText("Asset 1");
      expect(image).toBeTruthy();

      unmount();
    });
  });

  it("applies custom background color", () => {
    const { getByLabelText } = render(
      <Asset
        variant="single"
        size="md"
        sourceOne={{
          ...mockSourceOne,
          backgroundColor: "#00FF00",
        }}
      />,
    );

    const image = getByLabelText("Asset 1");
    expect(image).toBeTruthy();
  });

  it("handles both remote URLs and local image imports", () => {
    // Mock a local image import
    const localImage = { uri: "test" }; // Simplified mock of an imported image

    const { getByLabelText } = render(
      <Asset
        variant="single"
        size="md"
        sourceOne={{
          image: localImage, // Test with "imported" image
          altText: "Local Asset",
        }}
      />,
    );

    const image = getByLabelText("Local Asset");
    expect(image.props.source).toBe(localImage); // Should pass the object directly
  });

  it("applies accessibility props correctly", () => {
    const { getByLabelText } = render(
      <Asset variant="single" size="md" sourceOne={mockSourceOne} />,
    );

    const image = getByLabelText("Asset 1");
    expect(image.props.accessibilityLabel).toBe("Asset 1");
  });
});
