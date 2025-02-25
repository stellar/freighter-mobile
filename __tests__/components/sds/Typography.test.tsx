import { render } from "@testing-library/react-native";
import { Display, Text } from "components/sds/Typography";
import { THEME } from "config/sds/theme";
import React from "react";

describe("Typography", () => {
  describe("Display", () => {
    it("renders with default props", () => {
      const { getByText } = render(<Display>Test Text</Display>);
      const element = getByText("Test Text");
      expect(element).toBeTruthy();
    });

    it("renders with custom size", () => {
      const { getByText } = render(<Display size="xl">Large Text</Display>);
      expect(getByText("Large Text")).toBeTruthy();
    });

    it("renders with custom weight", () => {
      const { getByText } = render(<Display weight="bold">Bold Text</Display>);
      expect(getByText("Bold Text")).toBeTruthy();
    });

    it("renders with custom color", () => {
      const { getByText } = render(
        <Display color={THEME.colors.text.secondary}>Custom Color</Display>,
      );
      expect(getByText("Custom Color")).toBeTruthy();
    });

    it("renders with all custom props", () => {
      const { getByText } = render(
        <Display
          size="lg"
          weight="semiBold"
          color={THEME.colors.text.secondary}
        >
          Custom Text
        </Display>,
      );
      expect(getByText("Custom Text")).toBeTruthy();
    });
  });

  describe("Text", () => {
    it("renders with default props", () => {
      const { getByText } = render(<Text>Test Text</Text>);
      const element = getByText("Test Text");
      expect(element).toBeTruthy();
    });

    it("renders with custom size", () => {
      const { getByText } = render(<Text size="xl">Large Text</Text>);
      expect(getByText("Large Text")).toBeTruthy();
    });

    it("renders with custom weight", () => {
      const { getByText } = render(<Text weight="bold">Bold Text</Text>);
      expect(getByText("Bold Text")).toBeTruthy();
    });

    it("renders with custom color", () => {
      const { getByText } = render(
        <Text color={THEME.colors.text.secondary}>Custom Color</Text>,
      );
      expect(getByText("Custom Color")).toBeTruthy();
    });

    it("renders vertically centered", () => {
      const { getByText } = render(
        <Text isVerticallyCentered>Centered Text</Text>,
      );
      expect(getByText("Centered Text")).toBeTruthy();
    });

    it("renders with all custom props", () => {
      const { getByText } = render(
        <Text
          size="lg"
          weight="semiBold"
          color={THEME.colors.text.secondary}
          isVerticallyCentered
        >
          Custom Text
        </Text>,
      );
      expect(getByText("Custom Text")).toBeTruthy();
    });
  });
});
