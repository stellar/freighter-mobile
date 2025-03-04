import Clipboard from "@react-native-clipboard/clipboard";
import { fireEvent } from "@testing-library/react-native";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { fsValue, pxValue } from "helpers/dimensions";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("Input", () => {
  const onChangeTextMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Size handling", () => {
    it("applies correct styles for each field size", () => {
      const sizes = {
        sm: { fontSize: 12, lineHeight: 18, paddingVertical: 4 },
        md: { fontSize: 14, lineHeight: 20, paddingVertical: 6 },
        lg: { fontSize: 16, lineHeight: 24, paddingVertical: 8 },
      };

      Object.entries(sizes).forEach(([size, metrics]) => {
        const { getByTestId } = renderWithProviders(
          <Input
            fieldSize={size as "sm" | "md" | "lg"}
            testID="test-input"
            value=""
          />,
        );
        const input = getByTestId("test-input");

        expect(input.props.style).toMatchObject({
          fontSize: fsValue(metrics.fontSize),
          height: pxValue(metrics.lineHeight + 2 * metrics.paddingVertical),
        });
      });
    });

    it("defaults to medium size", () => {
      const { getByTestId } = renderWithProviders(
        <Input testID="test-input" value="" />,
      );
      const input = getByTestId("test-input");

      expect(input.props.style).toMatchObject({
        fontSize: fsValue(14), // md size
        height: pxValue(32), // lineHeight(20) + 2 * paddingVertical(6)
      });
    });
  });

  describe("Label handling", () => {
    it("renders label when provided", () => {
      const { getByText } = renderWithProviders(
        <Input label="Test Label" value="" />,
      );
      expect(getByText("Test Label")).toBeTruthy();
    });

    it("renders label suffix when provided", () => {
      const { getByText } = renderWithProviders(
        <Input label="Test Label" labelSuffix="(optional)" value="" />,
      );
      expect(getByText("(optional)")).toBeTruthy();
    });

    it("renders uppercase label when isLabelUppercase is true", () => {
      const { getByText } = renderWithProviders(
        <Input label="test label" isLabelUppercase value="" />,
      );
      expect(getByText("TEST LABEL")).toBeTruthy();
    });
  });

  describe("Error state", () => {
    it("applies error styles when isError is true", () => {
      const { getByTestId } = renderWithProviders(
        <Input isError testID="test-input" value="" />,
      );

      const inputContainer = getByTestId("test-input-container");
      expect(inputContainer.props.style).toMatchObject({
        borderColor: THEME.colors.status.error,
      });
    });

    it("applies error styles when error message is provided", () => {
      const { getByTestId, getByText } = renderWithProviders(
        <Input error="Error message" testID="test-input" value="" />,
      );

      const inputContainer = getByTestId("test-input-container");
      expect(inputContainer.props.style).toMatchObject({
        borderColor: THEME.colors.status.error,
      });
      expect(getByText("Error message")).toBeTruthy();
    });
  });

  describe("Side elements", () => {
    it("renders left element when provided", () => {
      const { getByTestId } = renderWithProviders(
        <Input
          leftElement={<Text testID="left-element">Left</Text>}
          testID="test-input"
          value=""
        />,
      );
      expect(getByTestId("left-element")).toBeTruthy();
    });

    it("renders right element when provided", () => {
      const { getByTestId } = renderWithProviders(
        <Input
          rightElement={<Text testID="right-element">Right</Text>}
          testID="test-input"
          value=""
        />,
      );
      expect(getByTestId("right-element")).toBeTruthy();
    });
  });

  describe("Copy button", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("renders copy button on the left when specified", () => {
      const { getByText } = renderWithProviders(
        <Input
          copyButton={{ position: "left", showLabel: true }}
          value="test"
        />,
      );
      expect(getByText("Copy")).toBeTruthy();
    });

    it("renders copy button on the right when specified", () => {
      const { getByText } = renderWithProviders(
        <Input
          copyButton={{ position: "right", showLabel: true }}
          value="test"
        />,
      );
      expect(getByText("Copy")).toBeTruthy();
    });

    it("copies text to clipboard when copy button is pressed", () => {
      const { getByText } = renderWithProviders(
        <Input
          copyButton={{ position: "right", showLabel: true }}
          value="test value"
        />,
      );

      fireEvent.press(getByText("Copy"));
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(Clipboard.setString).toHaveBeenCalledWith("test value");
    });
  });

  describe("Input interactions", () => {
    it("calls onChangeText when text changes", () => {
      const { getByTestId } = renderWithProviders(
        <Input testID="test-input" value="" onChangeText={onChangeTextMock} />,
      );

      fireEvent.changeText(getByTestId("test-input"), "new value");
      expect(onChangeTextMock).toHaveBeenCalledWith("new value");
    });

    it("handles disabled state", () => {
      const { getByTestId } = renderWithProviders(
        <Input testID="test-input" value="" editable={false} />,
      );

      const inputContainer = getByTestId("test-input-container");
      expect(inputContainer.props.style).toMatchObject({
        backgroundColor: THEME.colors.background.secondary,
      });
    });
  });

  describe("Messages", () => {
    it("renders note message when provided", () => {
      const { getByText } = renderWithProviders(
        <Input note="Helper text" value="" />,
      );
      expect(getByText("Helper text")).toBeTruthy();
    });

    it("renders success message when provided", () => {
      const { getByText } = renderWithProviders(
        <Input success="Success message" value="" />,
      );
      expect(getByText("Success message")).toBeTruthy();
    });
  });

  describe("Password input", () => {
    it("toggles secure text entry when isPassword is true", () => {
      const { getByTestId } = renderWithProviders(
        <Input isPassword testID="test-input" value="" />,
      );
      const input = getByTestId("test-input");
      expect(input.props.secureTextEntry).toBe(true);
    });
  });
});
