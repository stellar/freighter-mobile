import { fireEvent } from "@testing-library/react-native";
import { Textarea } from "components/sds/Textarea";
import { THEME } from "config/theme";
import { pxValue } from "helpers/dimensions";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("Textarea", () => {
  const onChangeTextMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Size handling", () => {
    it("applies correct styles for each field size", () => {
      const sizes = {
        sm: {
          fontSize: 12,
          lineHeight: 18,
          paddingVertical: 6,
          paddingHorizontal: 10,
          gap: 6,
          borderRadius: 4,
          lines: 2,
        },
        md: {
          fontSize: 14,
          lineHeight: 20,
          paddingVertical: 8,
          paddingHorizontal: 12,
          gap: 8,
          borderRadius: 6,
          lines: 3,
        },
        lg: {
          fontSize: 16,
          lineHeight: 24,
          paddingVertical: 10,
          paddingHorizontal: 14,
          gap: 8,
          borderRadius: 8,
          lines: 4,
        },
      };

      Object.entries(sizes).forEach(([size, metrics]) => {
        const { getByTestId } = renderWithProviders(
          <Textarea
            fieldSize={size as "sm" | "md" | "lg"}
            testID="test-textarea"
            value=""
          />,
        );
        const textarea = getByTestId("test-textarea");

        expect(textarea.props.style).toMatchObject({
          height: pxValue(metrics.lines * 28),
        });
        expect(textarea.props).toHaveProperty("numberOfLines", metrics.lines);
      });
    });

    it("defaults to medium size", () => {
      const { getByTestId } = renderWithProviders(
        <Textarea testID="test-textarea" value="" />,
      );
      const MD_SIZE_NUMBER_OF_LINES = 3;
      const textarea = getByTestId("test-textarea");

      expect(textarea.props.style).toMatchObject({
        height: pxValue(MD_SIZE_NUMBER_OF_LINES * 28),
      });
      expect(textarea.props).toHaveProperty(
        "numberOfLines",
        MD_SIZE_NUMBER_OF_LINES,
      );
    });
  });

  describe("Label handling", () => {
    it("renders label when provided", () => {
      const { getByText } = renderWithProviders(
        <Textarea label="Test Label" value="" />,
      );
      expect(getByText("Test Label")).toBeTruthy();
    });

    it("renders label suffix when provided", () => {
      const { getByText } = renderWithProviders(
        <Textarea label="Test Label" labelSuffix="(optional)" value="" />,
      );
      expect(getByText("(optional)")).toBeTruthy();
    });

    it("renders uppercase label when isLabelUppercase is true", () => {
      const { getByText } = renderWithProviders(
        <Textarea label="test label" isLabelUppercase value="" />,
      );
      expect(getByText("TEST LABEL")).toBeTruthy();
    });
  });

  describe("Error state", () => {
    it("applies error styles when isError is true", () => {
      const { getByTestId } = renderWithProviders(
        <Textarea isError testID="test-textarea" value="" />,
      );

      const textarea = getByTestId("test-textarea");

      expect(textarea.props.style).toMatchObject({
        borderColor: THEME.colors.status.error,
      });
    });

    it("applies error styles when error message is provided", () => {
      const { getByTestId, getByText } = renderWithProviders(
        <Textarea error="Error message" testID="test-textarea" value="" />,
      );

      const textarea = getByTestId("test-textarea");

      expect(textarea.props.style).toMatchObject({
        borderColor: THEME.colors.status.error,
      });
      expect(getByText("Error message")).toBeTruthy();
    });
  });

  describe("Textarea interactions", () => {
    it("calls onChangeText when text changes", () => {
      const { getByTestId } = renderWithProviders(
        <Textarea
          testID="test-textarea"
          value=""
          onChangeText={onChangeTextMock}
        />,
      );

      fireEvent.changeText(getByTestId("test-textarea"), "new value");
      expect(onChangeTextMock).toHaveBeenCalledWith("new value");
    });

    it("handles disabled state", () => {
      const { getByTestId } = renderWithProviders(
        <Textarea testID="test-textarea" value="" editable={false} />,
      );

      const textareaContainer = getByTestId("test-textarea");
      expect(textareaContainer.props.style).toMatchObject({
        backgroundColor: THEME.colors.background.secondary,
      });
    });
  });

  describe("Messages", () => {
    it("renders note message when provided", () => {
      const { getByText } = renderWithProviders(
        <Textarea note="Helper text" value="" />,
      );
      expect(getByText("Helper text")).toBeTruthy();
    });

    it("renders success message when provided", () => {
      const { getByText } = renderWithProviders(
        <Textarea success="Success message" value="" />,
      );
      expect(getByText("Success message")).toBeTruthy();
    });
  });
});
