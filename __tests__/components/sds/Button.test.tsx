import { fireEvent } from "@testing-library/react-native";
import { Button, ButtonSizes, ButtonVariants } from "components/sds/Button";
import { BUTTON_THEME } from "components/sds/Button/theme";
import { pxValue } from "helpers/dimensions";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("Button", () => {
  const onPressMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Variant handling", () => {
    it("uses explicit variant prop", () => {
      const { getByTestId } = renderWithProviders(
        <Button variant={ButtonVariants.SECONDARY} testID="test-button">
          Explicit Variant
        </Button>,
      );
      const button = getByTestId("test-button");

      expect(button.props.style).toMatchObject({
        backgroundColor: BUTTON_THEME.colors.secondary.background,
        borderColor: BUTTON_THEME.colors.secondary.border,
      });
    });

    it("uses variant shorthands", () => {
      const variants = [
        {
          prop: "primary",
          text: "Primary Button",
          expectedStyles: {
            backgroundColor: BUTTON_THEME.colors.primary.background,
            borderWidth: 0,
          },
        },
        {
          prop: "secondary",
          text: "Secondary Button",
          expectedStyles: {
            backgroundColor: BUTTON_THEME.colors.secondary.background,
            borderColor: BUTTON_THEME.colors.secondary.border,
          },
        },
        {
          prop: "tertiary",
          text: "Tertiary Button",
          expectedStyles: {
            backgroundColor: BUTTON_THEME.colors.tertiary.background,
            borderColor: BUTTON_THEME.colors.tertiary.border,
          },
        },
        {
          prop: "destructive",
          text: "Destructive Button",
          expectedStyles: {
            backgroundColor: BUTTON_THEME.colors.destructive.background,
            borderWidth: 0,
          },
        },
        {
          prop: "error",
          text: "Error Button",
          expectedStyles: {
            backgroundColor: BUTTON_THEME.colors.error.background,
            borderColor: BUTTON_THEME.colors.error.border,
          },
        },
      ];

      variants.forEach(({ prop, text, expectedStyles }) => {
        const { getByTestId } = renderWithProviders(
          <Button {...{ [prop]: true }} testID="test-button">
            {text}
          </Button>,
        );
        const button = getByTestId("test-button");
        expect(button.props.style).toMatchObject(expectedStyles);
      });
    });

    it("prioritizes explicit variant over shorthand", () => {
      const { getByTestId } = renderWithProviders(
        <Button variant={ButtonVariants.PRIMARY} secondary testID="test-button">
          Priority Test
        </Button>,
      );
      const button = getByTestId("test-button");

      expect(button.props.style).toMatchObject({
        backgroundColor: BUTTON_THEME.colors.primary.background,
        borderWidth: 0,
      });
    });

    it("defaults to primary variant", () => {
      const { getByTestId } = renderWithProviders(
        <Button testID="test-button">Default Variant</Button>,
      );
      const button = getByTestId("test-button");

      expect(button.props.style).toMatchObject({
        backgroundColor: BUTTON_THEME.colors.primary.background,
        borderWidth: 0,
      });
    });
  });

  describe("Size handling", () => {
    it("uses explicit size prop", () => {
      const { getByTestId } = renderWithProviders(
        <Button size={ButtonSizes.LARGE} testID="test-button">
          Explicit Size
        </Button>,
      );
      const button = getByTestId("test-button");

      expect(button.props.style).toMatchObject({
        height: pxValue(BUTTON_THEME.height.lg),
      });
    });

    it("uses size shorthands", () => {
      const sizes = [
        {
          prop: "sm",
          text: "Small Button",
          expectedStyle: {
            height: pxValue(BUTTON_THEME.height.sm),
          },
        },
        {
          prop: "md",
          text: "Medium Button",
          expectedStyle: {
            height: pxValue(BUTTON_THEME.height.md),
          },
        },
        {
          prop: "lg",
          text: "Large Button",
          expectedStyle: {
            height: pxValue(BUTTON_THEME.height.lg),
          },
        },
      ];

      sizes.forEach(({ prop, text, expectedStyle }) => {
        const { getByTestId } = renderWithProviders(
          <Button {...{ [prop]: true }} testID="test-button">
            {text}
          </Button>,
        );
        const button = getByTestId("test-button");
        expect(button.props.style).toMatchObject(expectedStyle);
      });
    });

    it("prioritizes explicit size over shorthand", () => {
      const { getByTestId } = renderWithProviders(
        <Button size={ButtonSizes.LARGE} sm testID="test-button">
          Priority Test
        </Button>,
      );
      const button = getByTestId("test-button");

      expect(button.props.style).toMatchObject({
        height: pxValue(BUTTON_THEME.height.lg),
      });
    });

    it("defaults to medium size", () => {
      const { getByTestId } = renderWithProviders(
        <Button testID="test-button">Default Size</Button>,
      );
      const button = getByTestId("test-button");

      expect(button.props.style).toMatchObject({
        height: pxValue(BUTTON_THEME.height.md),
      });
    });
  });

  describe("Loading state", () => {
    it("shows loading indicator when loading", () => {
      const { getByTestId } = renderWithProviders(
        <Button isLoading testID="test-button">
          Loading Button
        </Button>,
      );
      expect(getByTestId("button-loading-indicator")).toBeTruthy();
    });

    it("disables button when loading", () => {
      const { getByTestId } = renderWithProviders(
        <Button isLoading onPress={onPressMock} testID="test-button">
          Loading Button
        </Button>,
      );

      fireEvent.press(getByTestId("test-button"));
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  describe("Interactions", () => {
    it("handles press events when enabled", () => {
      const { getByTestId } = renderWithProviders(
        <Button onPress={onPressMock} testID="test-button">
          Clickable Button
        </Button>,
      );

      fireEvent.press(getByTestId("test-button"));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it("does not handle press events when disabled", () => {
      const { getByTestId } = renderWithProviders(
        <Button disabled onPress={onPressMock} testID="test-button">
          Disabled Button
        </Button>,
      );

      fireEvent.press(getByTestId("test-button"));
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  describe("Mixed usage", () => {
    it("handles combination of props and shorthands", () => {
      const { getByTestId } = renderWithProviders(
        <Button
          primary
          size={ButtonSizes.LARGE}
          isFullWidth
          disabled
          onPress={onPressMock}
          testID="test-button"
        >
          Mixed Props
        </Button>,
      );
      const button = getByTestId("test-button");

      expect(button.props.style).toMatchObject({
        backgroundColor: BUTTON_THEME.colors.disabled.background,
        height: pxValue(BUTTON_THEME.height.lg),
        width: "100%",
      });

      expect(button.props.accessibilityState).toEqual({ disabled: true });

      fireEvent.press(getByTestId("test-button"));
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });

  describe("Full width handling", () => {
    it("applies full width style when enabled", () => {
      const { getByTestId } = renderWithProviders(
        <Button isFullWidth testID="test-button">
          Full Width Button
        </Button>,
      );

      expect(getByTestId("test-button").props.style).toMatchObject({
        width: "100%",
      });
    });

    it("applies auto width style when disabled", () => {
      const { getByTestId } = renderWithProviders(
        <Button testID="test-button">Auto Width Button</Button>,
      );

      expect(getByTestId("test-button").props.style).toMatchObject({
        width: "auto",
      });
    });
  });

  describe("Text styling", () => {
    it("applies correct text styles based on button size", () => {
      const { getByText } = renderWithProviders(
        <Button lg testID="test-button">
          Large Button
        </Button>,
      );

      const textElement = getByText("Large Button");
      expect(textElement.props.style).toMatchObject({
        fontSize: pxValue(16),
        fontWeight: "600", // semiBold
      });
    });

    it("applies correct text color based on variant and state", () => {
      const { getByText } = renderWithProviders(
        <Button secondary disabled testID="test-button">
          Disabled Button
        </Button>,
      );

      const textElement = getByText("Disabled Button");
      expect(textElement.props.style).toMatchObject({
        color: BUTTON_THEME.colors.disabled.text,
      });
    });
  });
});
