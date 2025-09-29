import Clipboard from "@react-native-clipboard/clipboard";
import { fireEvent } from "@testing-library/react-native";
import { Input, StyledTextInput } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("Input", () => {
  const onChangeTextMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Size handling", () => {
    it("applies correct classes for each field size", () => {
      const sizeMap = {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
      };

      Object.entries(sizeMap).forEach(([size]) => {
        const { getByTestId } = renderWithProviders(
          <Input
            fieldSize={size as "sm" | "md" | "lg"}
            testID="test-input"
            value=""
          />,
        );
        const input = getByTestId("test-input");

        // Check that the input has the correct font size class
        const expectedFontSizeClass = sizeMap[size as keyof typeof sizeMap];
        expect(input.props.className).toContain(expectedFontSizeClass);
      });
    });

    it("defaults to large size", () => {
      const { getByTestId } = renderWithProviders(
        <Input testID="test-input" value="" />,
      );
      const input = getByTestId("test-input");

      // Check that the input has the correct font size class
      expect(input.props.className).toContain("text-base");
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
    it("applies error classes when isError is true", () => {
      const { getByTestId } = renderWithProviders(
        <Input isError testID="test-input" value="" />,
      );

      const inputContainer = getByTestId("test-input-container");
      expect(inputContainer.props.className).toContain("border-status-error");
    });

    it("applies error classes when error message is provided", () => {
      const { getByTestId, getByText } = renderWithProviders(
        <Input error="Error message" testID="test-input" value="" />,
      );

      const inputContainer = getByTestId("test-input-container");
      expect(inputContainer.props.className).toContain("border-status-error");
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
      expect(inputContainer.props.className).toContain(
        "bg-background-secondary",
      );
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

  describe("Custom styling", () => {
    it("applies custom style when provided", () => {
      const customStyle = {
        borderColor: "#ff0000",
        borderWidth: 2,
        borderRadius: 10,
        paddingHorizontal: 16,
      };

      const { getByTestId } = renderWithProviders(
        <Input testID="test-input" value="" style={customStyle} />,
      );
      const input = getByTestId("test-input");

      // Style is now an array [inputStyles, customStyle]
      expect(input.props.style).toContainEqual(
        expect.objectContaining(customStyle),
      );
    });
  });

  describe("StyledTextInput", () => {
    it("renders as standalone TextInput with container", () => {
      const { getByTestId } = renderWithProviders(
        <StyledTextInput testID="test-styled-input" value="test" />,
      );
      const container = getByTestId("test-styled-input");

      expect(container).toBeTruthy();
      expect(container.props.className).toContain("bg-background-default");
      expect(container.props.className).toContain("border");
    });

    it("applies custom style when provided", () => {
      const customStyle = {
        borderColor: "#00ff00",
        borderWidth: 1,
        borderRadius: 5,
        flex: 1,
      };

      const { getByTestId } = renderWithProviders(
        <StyledTextInput
          testID="test-styled-input"
          value=""
          style={customStyle}
        />,
      );
      const container = getByTestId("test-styled-input");

      // StyledTextInput now wraps TextInputComponent in a View container
      // The height and padding are applied via className, custom style is applied to the container
      expect(container.props.className).toContain("h-[48px]");
      expect(container.props.className).toContain("pl-[14px]");
      expect(container.props.className).toContain("pr-[14px]");
      expect(container.props.style).toEqual(
        expect.objectContaining(customStyle),
      );
    });
  });
});
