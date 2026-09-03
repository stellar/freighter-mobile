/* eslint-disable no-promise-executor-return */
/* eslint-disable @typescript-eslint/require-await */
import { act, fireEvent, render } from "@testing-library/react-native";
import { Token } from "components/sds/Token";
import { Text } from "components/sds/Typography";
import { useTokenIconsStore } from "ducks/tokenIcons";
import { ICON_VALIDATION_TIMEOUT } from "helpers/validateIconUrl";
import React from "react";

// Mock the token icons store so `source.token` resolution can be driven
// deterministically per test.
jest.mock("ducks/tokenIcons", () => ({
  useTokenIconsStore: jest.fn(),
}));

// Mock the bundled logo assets so tests can assert on a stable sentinel
// rather than the real image module.
jest.mock("assets/logos", () => ({
  logos: {
    stellar: "stellar-logo-url",
    usdc: "usdc-logo-url",
  },
}));

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
    expect(image.props.source).toMatchObject({
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
    expect(image1.props.source).toMatchObject({
      uri: "https://example.com/token1.png",
    });
    expect(image2.props.source).toMatchObject({
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

      // Whitespace-only URL is treated as no URL — fallback visible immediately
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

    it("shows renderContent as background while image is loading", () => {
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

      // Image is in tree during loading (opacity:0) — accessible for events
      const image = getByLabelText("Token with timeout");
      expect(image).toBeTruthy();

      // Fallback is always visible as background until image confirms loaded
      expect(getByText("Timeout Fallback")).toBeTruthy();
    });

    it("hides spinner when image loads successfully", async () => {
      // Logic for spinner validation removed as spinner was removed from Token component
      // This test effectively checks that the image renders
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

      // After load, image should still be rendered
      expect(image).toBeTruthy();
      expect(image.props.source).toMatchObject({
        uri: "https://example.com/token.png",
      });
    });

    it("shows fallback when image errors", async () => {
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

      // After error, fallback should be shown
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

    it("keeps fallback visible after ICON_VALIDATION_TIMEOUT without load end", () => {
      jest.useFakeTimers();
      const renderContent = () => <Text>Timeout Fallback</Text>;

      const { getByLabelText, queryByLabelText, getByText } = render(
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

      // During loading: image in tree (opacity:0), fallback visible as background
      expect(getByLabelText("Token with timeout")).toBeTruthy();
      expect(getByText("Timeout Fallback")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(ICON_VALIDATION_TIMEOUT);
      });

      // After timeout: image removed from tree (prevents RN auto-retry), fallback still visible
      expect(queryByLabelText("Token with timeout")).toBeNull();
      expect(getByText("Timeout Fallback")).toBeTruthy();
      jest.useRealTimers();
    });

    it("keeps fallback visible after ICON_VALIDATION_TIMEOUT when source is loading", () => {
      jest.useFakeTimers();
      const renderContent = () => <Text>Loading Fallback</Text>;

      const { getByText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            image: "https://example.com/loading.png",
            altText: "Token loading",
            renderContent,
            isLoading: true,
          }}
        />,
      );

      // Fallback visible immediately (loader overlay shown on top)
      expect(getByText("Loading Fallback")).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(ICON_VALIDATION_TIMEOUT);
      });

      // Still visible after timeout
      expect(getByText("Loading Fallback")).toBeTruthy();
      jest.useRealTimers();
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

  describe("source.token resolution", () => {
    const mockUseTokenIconsStore = useTokenIconsStore as jest.MockedFunction<
      typeof useTokenIconsStore
    >;

    const mockValidateIconOnAccess = jest.fn();
    let mockState: any;

    const classicXlmCodedAsset = {
      code: "XLM",
      issuer: "GBEO62ZYAOEKVL4WMF5Q6VYTOJQUT7H2QYRDVFO5LT4W7VQPFDWVKUHO",
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockState = {
        icons: {},
        validateIconOnAccess: mockValidateIconOnAccess,
      };

      mockUseTokenIconsStore.mockImplementation((selector: any) => {
        if (typeof selector === "function") {
          return selector(mockState);
        }
        return mockState;
      });
    });

    it("does not render the bundled Stellar logo for an XLM-coded classic asset", () => {
      const { getByTestId, queryByLabelText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            altText: "Classic asset with XLM code",
            token: classicXlmCodedAsset,
          }}
        />,
      );

      // The bundled Stellar logo (mocked sentinel) must never appear.
      const image = queryByLabelText("Classic asset with XLM code");
      expect(image?.props.source?.uri).not.toBe("stellar-logo-url");

      // No icon in the store and no source.image: the fallback container
      // is what's shown.
      expect(getByTestId("token")).toBeTruthy();
    });

    it("consults the icon store for an XLM-coded classic asset", () => {
      const identifier = `${classicXlmCodedAsset.code}:${classicXlmCodedAsset.issuer}`;
      mockState.icons[identifier] = {
        imageUrl: "https://example.com/classic-xlm-coded-icon.png",
        isValidated: true,
        isValid: true,
      };

      const { getByLabelText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            altText: "Classic asset with XLM code",
            token: classicXlmCodedAsset,
          }}
        />,
      );

      const image = getByLabelText("Classic asset with XLM code");
      expect(image.props.source).toMatchObject({
        uri: "https://example.com/classic-xlm-coded-icon.png",
      });
    });

    it("still renders the bundled Stellar logo for a native-coded token with an empty issuer", () => {
      const { getByLabelText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            altText: "Native token",
            token: { code: "XLM", issuer: "" },
          }}
        />,
      );

      const image = getByLabelText("Native token");
      expect(image.props.source).toMatchObject({
        uri: "stellar-logo-url",
      });
    });

    it("still renders the bundled Stellar logo when only source.image is provided (no token prop)", () => {
      const { getByLabelText } = render(
        <Token
          variant="single"
          size="md"
          sourceOne={{
            altText: "Native token",
            image: "stellar-logo-url",
          }}
        />,
      );

      const image = getByLabelText("Native token");
      expect(image.props.source).toMatchObject({
        uri: "stellar-logo-url",
      });
    });
  });
});
