import { act } from "@testing-library/react-native";
import { App, AppSize } from "components/sds/App";
import { Text } from "components/sds/Typography";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { Image } from "react-native";
import { SvgUri } from "react-native-svg";

describe("App", () => {
  const defaultProps = {
    appName: "TestApp",
  };

  describe("Size handling", () => {
    it("uses default size (md) when not specified", () => {
      const { getByTestId } = renderWithProviders(
        <App {...defaultProps} testID="test-app" />,
      );
      const app = getByTestId("test-app");

      expect(app.props.className).toContain("w-8 h-8");
    });

    it("uses specified size", () => {
      const sizes: AppSize[] = ["sm", "md", "lg", "xl"];
      const sizeClasses = {
        sm: "w-6 h-6",
        md: "w-8 h-8",
        lg: "w-10 h-10",
        xl: "w-12 h-12",
      };

      sizes.forEach((size) => {
        const { getByTestId } = renderWithProviders(
          <App {...defaultProps} size={size} testID={`test-app-${size}`} />,
        );
        const app = getByTestId(`test-app-${size}`);

        expect(app.props.className).toContain(sizeClasses[size]);
      });
    });
  });

  describe("Image handling", () => {
    it("renders PNG image when provided", () => {
      const { getByTestId } = renderWithProviders(
        <App
          {...defaultProps}
          favicon="https://example.com/icon.png"
          testID="test-app"
        />,
      );
      const app = getByTestId("test-app");
      const image = app.findByType(Image);

      expect(image.props.source.uri).toBe("https://example.com/icon.png");
    });

    it("renders SVG image when provided", () => {
      const { getByTestId } = renderWithProviders(
        <App
          {...defaultProps}
          favicon="https://example.com/icon.svg"
          testID="test-app"
        />,
      );
      const app = getByTestId("test-app");
      const svg = app.findByType(SvgUri);

      expect(svg.props.uri).toBe("https://example.com/icon.svg");
    });

    it("falls back to initials when image fails to load", async () => {
      const { getByTestId } = renderWithProviders(
        <App
          {...defaultProps}
          favicon="https://example.com/invalid.png"
          testID="test-app"
        />,
      );
      const app = getByTestId("test-app");

      // Simulate image error
      await act(async () => {
        const image = app.findByType(Image);
        image.props.onError();
        // Wait for state update
        // eslint-disable-next-line no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, 200));
      });

      // Should now show initials
      const text = getByTestId("test-app").findByType(Text);
      expect(text.props.children).toBe("Te");
    });
  });

  describe("App name handling", () => {
    it("displays first two letters of app name as initials", () => {
      const { getByTestId } = renderWithProviders(
        <App {...defaultProps} testID="test-app" />,
      );
      const app = getByTestId("test-app");
      const text = app.findByType(Text);

      expect(text.props.children).toBe("Te");
    });

    it("handles single word app names", () => {
      const { getByTestId } = renderWithProviders(
        <App appName="Single" testID="test-app" />,
      );
      const app = getByTestId("test-app");
      const text = app.findByType(Text);

      expect(text.props.children).toBe("Si");
    });

    it("handles multi-word app names", () => {
      const { getByTestId } = renderWithProviders(
        <App appName="Multi Word App" testID="test-app" />,
      );
      const app = getByTestId("test-app");
      const text = app.findByType(Text);

      expect(text.props.children).toBe("Mu");
    });
  });
});
