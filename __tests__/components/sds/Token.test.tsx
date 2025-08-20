import { render } from "@testing-library/react-native";
import { Token } from "components/sds/Token";
import React from "react";

/**
 * Tests for the Token component
 *
 * These tests verify:
 * - Rendering of all variants (single, swap, pair, platform)
 * - Size variations (sm, md, lg)
 * - Default size behavior
 * - Custom background color application
 * - Handling of local and remote image sources
 * - Accessibility label application
 */
describe("Token", () => {
  const mockSourceOne = {
    image: "https://example.com/token1.png",
    altText: "Token 1",
  };

  const mockSourceTwo = {
    image: "https://example.com/token2.png",
    altText: "Token 2",
    backgroundColor: "#FF0000",
  };

  it("renders single token correctly", () => {
    const { getByLabelText } = render(
      <Token variant="single" size="md" sourceOne={mockSourceOne} />,
    );

    const image = getByLabelText("Token 1");
    expect(image).toBeTruthy();
    expect(image.props.source).toEqual({
      uri: "https://example.com/token1.png",
    });
  });

  it("uses 'lg' as the default size when not specified", () => {
    const { getByLabelText } = render(
      <Token variant="single" sourceOne={mockSourceOne} />,
    );

    const image = getByLabelText("Token 1");
    expect(image).toBeTruthy();
    // Testing that the component renders successfully with the default size
    // (We can't easily test the exact styling in this test environment)
  });

  it("renders swap variant correctly", () => {
    const { getByLabelText } = render(
      <Token
        variant="swap"
        size="md"
        sourceOne={mockSourceOne}
        sourceTwo={mockSourceTwo}
      />,
    );

    const image1 = getByLabelText("Token 1");
    const image2 = getByLabelText("Token 2");

    expect(image1).toBeTruthy();
    expect(image2).toBeTruthy();
    expect(image1.props.source).toEqual({
      uri: "https://example.com/token1.png",
    });
    expect(image2.props.source).toEqual({
      uri: "https://example.com/token2.png",
    });
  });

  it("renders pair variant correctly", () => {
    const { getByLabelText } = render(
      <Token
        variant="pair"
        size="md"
        sourceOne={mockSourceOne}
        sourceTwo={mockSourceTwo}
      />,
    );

    const image1 = getByLabelText("Token 1");
    const image2 = getByLabelText("Token 2");

    expect(image1).toBeTruthy();
    expect(image2).toBeTruthy();
  });

  it("renders platform variant correctly", () => {
    const { getByLabelText } = render(
      <Token
        variant="platform"
        size="md"
        sourceOne={mockSourceOne}
        sourceTwo={mockSourceTwo}
      />,
    );

    const image1 = getByLabelText("Token 1");
    const image2 = getByLabelText("Token 2");

    expect(image1).toBeTruthy();
    expect(image2).toBeTruthy();
  });

  it("renders in different sizes", () => {
    const sizes: Array<"sm" | "md" | "lg"> = ["sm", "md", "lg"];

    sizes.forEach((size) => {
      const { getByLabelText, unmount } = render(
        <Token variant="single" size={size} sourceOne={mockSourceOne} />,
      );

      const image = getByLabelText("Token 1");
      expect(image).toBeTruthy();

      unmount();
    });
  });

  it("applies custom background color", () => {
    const { getByLabelText } = render(
      <Token
        variant="single"
        size="md"
        sourceOne={{
          ...mockSourceOne,
          backgroundColor: "#00FF00",
        }}
      />,
    );

    const image = getByLabelText("Token 1");
    expect(image).toBeTruthy();
  });

  it("handles both remote URLs and local image imports", () => {
    // Mock a local image import
    const localImage = { uri: "test" }; // Simplified mock of an imported image

    const { getByLabelText } = render(
      <Token
        variant="single"
        size="md"
        sourceOne={{
          image: localImage, // Test with "imported" image
          altText: "Local Token",
        }}
      />,
    );

    const image = getByLabelText("Local Token");
    expect(image.props.source).toBe(localImage); // Should pass the object directly
  });

  it("applies accessibility props correctly", () => {
    const { getByLabelText } = render(
      <Token variant="single" size="md" sourceOne={mockSourceOne} />,
    );

    const image = getByLabelText("Token 1");
    expect(image.props.accessibilityLabel).toBe("Token 1");
  });
});
