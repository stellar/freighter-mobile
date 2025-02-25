import { render, fireEvent } from "@testing-library/react-native";
import { Button, ButtonVariant, ButtonSize } from "components/sds/Button";
import React from "react";

describe("Button", () => {
  const onPressMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders with default props", () => {
      const { getByText } = render(<Button>Default Button</Button>);
      expect(getByText("Default Button")).toBeTruthy();
    });

    it("renders with custom variant", () => {
      Object.values(ButtonVariant).forEach((variant) => {
        const { getByText } = render(
          <Button variant={variant}>{variant} Button</Button>,
        );
        expect(getByText(`${variant} Button`)).toBeTruthy();
      });
    });

    it("renders with custom size", () => {
      Object.values(ButtonSize).forEach((size) => {
        const { getByText } = render(
          <Button size={size}>{size} Button</Button>,
        );
        expect(getByText(`${size} Button`)).toBeTruthy();
      });
    });

    it("renders with loading state", () => {
      const { getByTestId, queryByText } = render(
        <Button isLoading>Loading Button</Button>,
      );

      expect(getByTestId("button-loading-indicator")).toBeTruthy();
      expect(queryByText("Loading Button")).toBeTruthy();
    });
  });

  describe("Interactions", () => {
    it("handles press events when enabled", () => {
      const { getByText } = render(
        <Button onPress={onPressMock}>Clickable Button</Button>,
      );

      fireEvent.press(getByText("Clickable Button"));
      expect(onPressMock).toHaveBeenCalledTimes(1);
    });

    it("does not handle press events when disabled", () => {
      const { getByText } = render(
        <Button disabled onPress={onPressMock}>
          Disabled Button
        </Button>,
      );

      fireEvent.press(getByText("Disabled Button"));
      expect(onPressMock).not.toHaveBeenCalled();
    });

    it("does not handle press events when loading", () => {
      const { getByText } = render(
        <Button isLoading onPress={onPressMock}>
          Loading Button
        </Button>,
      );

      fireEvent.press(getByText("Loading Button"));
      expect(onPressMock).not.toHaveBeenCalled();
    });
  });
});
