import { render, screen } from "@testing-library/react-native";
import { ErrorBoundary } from "components/ErrorBoundary";
import { logger } from "config/logger";
import React from "react";
import { Text } from "react-native";

/** Renders `child`, or throws while rendering when `shouldThrow` is set. */
const Thrower = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("render failed");
  }

  return <Text>child</Text>;
};

describe("ErrorBoundary", () => {
  const onError = jest.fn();

  /** A boundary around a `Thrower`, built again by the rerender tests. */
  const boundary = (shouldThrow: boolean, resetKey: string) => (
    <ErrorBoundary
      name="TestBoundary"
      fallback={<Text>fallback</Text>}
      onError={onError}
      resetKey={resetKey}
    >
      <Thrower shouldThrow={shouldThrow} />
    </ErrorBoundary>
  );

  beforeEach(() => {
    // React logs every error a boundary catches; the report is asserted on
    // instead, so the log would only be noise.
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(logger.error).mockClear();
    onError.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders its children when nothing throws", () => {
    render(boundary(false, "a"));

    expect(screen.getByText("child")).toBeTruthy();
    expect(screen.queryByText("fallback")).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("renders the fallback, reports once and calls onError when a child throws", () => {
    render(boundary(true, "a"));

    expect(screen.getByText("fallback")).toBeTruthy();
    expect(screen.queryByText("child")).toBeNull();
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      "TestBoundary",
      "Render error caught by error boundary",
      expect.objectContaining({ message: "render failed" }),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: "render failed" }),
    );
    // onError runs after the error is reported.
    const [reportedAt] = jest.mocked(logger.error).mock.invocationCallOrder;
    const [handledAt] = onError.mock.invocationCallOrder;
    expect(reportedAt).toBeLessThan(handledAt);
  });

  it("keeps the fallback while resetKey is unchanged", () => {
    const { rerender } = render(boundary(true, "a"));

    rerender(boundary(false, "a"));

    expect(screen.getByText("fallback")).toBeTruthy();
    expect(screen.queryByText("child")).toBeNull();
    // The rerender is not a new error: nothing is reported again.
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("renders the children again when resetKey changes", () => {
    const { rerender } = render(boundary(true, "a"));

    rerender(boundary(false, "b"));

    expect(screen.getByText("child")).toBeTruthy();
    expect(screen.queryByText("fallback")).toBeNull();
  });

  it("reports the next error when the children throw again after a reset", () => {
    const { rerender } = render(boundary(true, "a"));

    rerender(boundary(true, "b"));

    expect(screen.getByText("fallback")).toBeTruthy();
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledTimes(2);
  });
});
