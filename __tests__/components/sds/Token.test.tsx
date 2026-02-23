/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/require-await */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Token } from "components/sds/Token";
import { Text } from "components/sds/Typography";
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

  describe("Fallback behavior", () => {
    it("shows renderContent when no image is provided", () => {
      const renderContent = () => <Text>Fallback Text</Text>;

      const { getByText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            altText: "Token without image",
            renderContent,
          }}
        />,
      );

      expect(getByText("Fallback Text")).toBeTruthy();
    });

    it("shows renderContent when image is empty string", () => {
      const renderContent = () => <Text>Empty Image Fallback</Text>;

      const { getByText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            image: "",
            altText: "Token with empty image",
            renderContent,
          }}
        />,
      );

      expect(getByText("Empty Image Fallback")).toBeTruthy();
    });

    it("shows renderContent when image is whitespace-only string", () => {
      const renderContent = () => <Text>Whitespace Image Fallback</Text>;

      const { getByText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            image: "   ",
            altText: "Token with whitespace image",
            renderContent,
          }}
        />,
      );

      expect(getByText("Whitespace Image Fallback")).toBeTruthy();
    });

    it("shows renderContent when image fails to load", async () => {
      const renderContent = () => <Text>Error Fallback</Text>;

      const { getByLabelText, getByText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            image: "https://example.com/invalid.png",
            altText: "Token with error",
            renderContent,
          }}
        />,
      );

      const image = getByLabelText("Token with error");

      // Simulate image error
      await act(async () => {
        fireEvent(image, "error");
        // Wait for state update
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(getByText("Error Fallback")).toBeTruthy();
    });

    it("shows renderContent after timeout when image does not load", async () => {
      jest.useFakeTimers();

      const renderContent = () => <Text>Timeout Fallback</Text>;

      const { getByLabelText, getByText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            image: "https://example.com/slow-loading.png",
            altText: "Token with timeout",
            renderContent,
          }}
        />,
      );

      // Initially should show image (with spinner overlay)
      const image = getByLabelText("Token with timeout");
      expect(image).toBeTruthy();

      // Fast-forward time by 1 second to trigger timeout
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Wait for state update
      await waitFor(() => {
        expect(getByText("Timeout Fallback")).toBeTruthy();
      });

      jest.useRealTimers();
    });

    it("shows spinner while image is loading", () => {
      const { getByLabelText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            image: "https://example.com/slow-loading.png",
            altText: "Token loading",
          }}
        />,
      );

      const image = getByLabelText("Token loading");
      expect(image).toBeTruthy();

      // Image should be rendered (spinner is shown as overlay, but we verify image exists)
      // The spinner overlay is present when isLoading is true
      expect(image).toBeTruthy();
    });

    it("hides spinner when image loads successfully", async () => {
      const { getByLabelText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            image: "https://example.com/token.png",
            altText: "Token loading",
          }}
        />,
      );

      const image = getByLabelText("Token loading");
      expect(image).toBeTruthy();

      // Simulate successful image load immediately
      act(() => {
        fireEvent(image, "load");
      });

      // After load, image should still be rendered (spinner overlay hidden)
      expect(image).toBeTruthy();
      expect(image.props.source).toEqual({
        uri: "https://example.com/token.png",
      });
    });

    it("hides spinner when image errors", async () => {
      const renderContent = () => <Text>Error Fallback</Text>;

      const { getByLabelText, getByText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            image: "https://example.com/invalid.png",
            altText: "Token with error",
            renderContent,
          }}
        />,
      );

      const image = getByLabelText("Token with error");
      expect(image).toBeTruthy();

      // Simulate image error
      await act(async () => {
        fireEvent(image, "error");
        // Wait for state update
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // After error, fallback should be shown (spinner is hidden)
      expect(getByText("Error Fallback")).toBeTruthy();
    });

    it("does not show renderContent when image loads successfully", async () => {
      const renderContent = () => <Text>Should Not Show</Text>;

      const { getByLabelText, queryByText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            image: "https://example.com/token.png",
            altText: "Token loading",
            renderContent,
          }}
        />,
      );

      const image = getByLabelText("Token loading");

      // Simulate successful image load immediately
      act(() => {
        fireEvent(image, "load");
      });

      // Wait a bit for any async state updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Fallback should not be shown
      expect(queryByText("Should Not Show")).toBeFalsy();
    });

    it("renders container when no image and no renderContent provided", () => {
      // Should render without errors even when ImageWithFallback returns null
      const { getByTestId } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            altText: "Token without image or fallback",
          }}
        />,
      );

      // Container should still be rendered
      expect(getByTestId("token")).toBeTruthy();
    });
  });
});
