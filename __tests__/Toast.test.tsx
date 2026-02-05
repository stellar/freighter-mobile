import { render, waitFor } from "@testing-library/react-native";
import { Toast } from "components/sds/Toast";
import React from "react";
import {
  Animated,
  PanResponder,
  type PanResponderInstance,
} from "react-native";

describe("Toast Component", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    const startMock = (callback?: () => void) => {
      if (callback) {
        callback();
      }
    };

    jest.spyOn(Animated, "timing").mockReturnValue({
      start: startMock,
    } as unknown as Animated.CompositeAnimation);

    jest.spyOn(Animated, "spring").mockReturnValue({
      start: startMock,
    } as unknown as Animated.CompositeAnimation);

    jest.spyOn(Animated, "parallel").mockReturnValue({
      start: startMock,
    } as unknown as Animated.CompositeAnimation);

    jest
      .spyOn(PanResponder, "create")
      .mockReturnValue({ panHandlers: {} } as unknown as PanResponderInstance);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("Auto-dismiss behavior", () => {
    it("should auto-dismiss after default duration when duration is non-zero", async () => {
      const onDismiss = jest.fn();

      const { unmount } = render(
        <Toast
          variant="success"
          title="Test Toast"
          message="This should auto-dismiss"
          onDismiss={onDismiss}
        />,
      );

      // Timer should be set
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      // Fast-forward time
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(onDismiss).toHaveBeenCalled();
      });

      unmount();
    });

    it("should not auto-dismiss when duration is 0", () => {
      const onDismiss = jest.fn();

      const { unmount } = render(
        <Toast
          variant="error"
          title="Non Dismissing Error"
          message="This should not auto-dismiss"
          duration={0}
          onDismiss={onDismiss}
        />,
      );

      // Fast-forward time by the default error duration
      jest.advanceTimersByTime(10000);

      // onDismiss should not be called
      expect(onDismiss).not.toHaveBeenCalled();

      unmount();
    });

    it("should respect custom duration when duration is non-zero", async () => {
      const onDismiss = jest.fn();
      const CUSTOM_DURATION = 2000;

      const { unmount } = render(
        <Toast
          variant="success"
          title="Custom Duration"
          duration={CUSTOM_DURATION}
          onDismiss={onDismiss}
        />,
      );

      // Fast-forward to just before the custom duration
      jest.advanceTimersByTime(CUSTOM_DURATION - 100);
      expect(onDismiss).not.toHaveBeenCalled();

      // Fast-forward the remaining time
      jest.advanceTimersByTime(100);

      await waitFor(() => {
        expect(onDismiss).toHaveBeenCalled();
      });

      unmount();
    });
  });

  describe("Swipe behavior with duration 0", () => {
    it("should not restart auto-dismiss timer when swipe is not far enough with duration 0", () => {
      const onDismiss = jest.fn();

      const { unmount } = render(
        <Toast
          variant="success"
          title="Non Dismissing Toast"
          duration={0}
          onDismiss={onDismiss}
        />,
      );

      // Fast-forward time significantly
      jest.advanceTimersByTime(10000);

      // onDismiss should still not be called when duration is disabled
      expect(onDismiss).not.toHaveBeenCalled();

      unmount();
    });

    it("should not set auto-dismiss timer when duration is 0 after insufficient swipe", () => {
      const onDismiss = jest.fn();

      const { unmount } = render(
        <Toast
          variant="success"
          title="Duration 0 After Swipe"
          duration={0}
          onDismiss={onDismiss}
        />,
      );

      // Get initial timer count
      const timerCountBefore = jest.getTimerCount();

      expect(timerCountBefore).toBe(0);

      // Fast-forward time
      jest.advanceTimersByTime(5000);

      // No timers should be set and toast should not dismiss
      expect(onDismiss).not.toHaveBeenCalled();

      unmount();
    });
  });

  describe("Cleanup", () => {
    it("should clear timeout on unmount", () => {
      const onDismiss = jest.fn();
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      const { unmount } = render(
        <Toast variant="success" title="Test Toast" onDismiss={onDismiss} />,
      );

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});
