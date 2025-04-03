import { render, waitFor } from "@testing-library/react-native";
import { Toast } from "components/sds/Toast";
import React from "react";

describe("Toast", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders correctly with title only", () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <Toast variant="success" title="Test Toast" onDismiss={onDismiss} />,
    );

    expect(getByText("Test Toast")).toBeTruthy();
  });

  it("renders correctly with title and message", () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <Toast
        variant="success"
        title="Test Toast"
        message="This is a test message"
        onDismiss={onDismiss}
      />,
    );

    expect(getByText("Test Toast")).toBeTruthy();
    expect(getByText("This is a test message")).toBeTruthy();
  });

  it("auto-dismisses after duration", async () => {
    const onDismiss = jest.fn();
    render(
      <Toast
        variant="success"
        title="Test Toast"
        duration={3000}
        onDismiss={onDismiss}
      />,
    );

    // Fast-forward 3 seconds
    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  it("uses default duration of 3000ms if not provided", async () => {
    const onDismiss = jest.fn();
    render(
      <Toast variant="success" title="Test Toast" onDismiss={onDismiss} />,
    );

    // Fast-forward 3 seconds
    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalled();
    });
  });
});
