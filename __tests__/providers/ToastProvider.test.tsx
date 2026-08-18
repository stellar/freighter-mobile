import { act, render } from "@testing-library/react-native";
import { UNLOCK_ERROR_TOAST_ID } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { ToastProvider, useToast } from "providers/ToastProvider";
import React, { useEffect } from "react";
import {
  Animated,
  PanResponder,
  type PanResponderInstance,
} from "react-native";

const SHOWN_TITLE = "Background validation";
const ALLOWED_TITLE = "Unlock failed";

const ToastEmitter: React.FC<{
  title: string;
  toastId?: string;
}> = ({ title, toastId }) => {
  const { showToast } = useToast();

  useEffect(() => {
    showToast({ variant: "error", title, toastId });
  }, [showToast, title, toastId]);

  return null;
};

describe("ToastProvider soft-lock suppression", () => {
  beforeEach(() => {
    // The rendered Toast runs Animated loops + a duration-based auto-dismiss
    // setTimeout; mock them (as Toast.test.tsx does) so no real timers/anim
    // frames leak and hang the worker on exit.
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

    useAuthenticationStore.setState({ isSoftLocked: false });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders toasts normally when not soft-locked", () => {
    const { queryByText } = render(
      <ToastProvider>
        <ToastEmitter title={SHOWN_TITLE} toastId="bg-1" />
      </ToastProvider>,
    );

    expect(queryByText(SHOWN_TITLE)).toBeTruthy();
  });

  it("suppresses background toasts while soft-locked", () => {
    act(() => {
      useAuthenticationStore.setState({ isSoftLocked: true });
    });

    const { queryByText } = render(
      <ToastProvider>
        <ToastEmitter title={SHOWN_TITLE} toastId="bg-1" />
      </ToastProvider>,
    );

    expect(queryByText(SHOWN_TITLE)).toBeNull();
  });

  it("still shows the lock overlay's own unlock-error toast while soft-locked", () => {
    act(() => {
      useAuthenticationStore.setState({ isSoftLocked: true });
    });

    const { queryByText } = render(
      <ToastProvider>
        <ToastEmitter title={ALLOWED_TITLE} toastId={UNLOCK_ERROR_TOAST_ID} />
      </ToastProvider>,
    );

    expect(queryByText(ALLOWED_TITLE)).toBeTruthy();
  });
});
