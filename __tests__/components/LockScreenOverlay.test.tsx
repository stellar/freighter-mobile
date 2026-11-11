import { act } from "@testing-library/react-native";
import { LockScreenOverlay } from "components/LockScreenOverlay";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { BackHandler } from "react-native";

jest.mock("services/autoLock", () => ({
  persistAutoLockTimer: jest.fn().mockResolvedValue(undefined),
}));

describe("LockScreenOverlay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when the wallet is not soft-locked", () => {
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.AUTHENTICATED,
      isSoftLocked: false,
    });

    const { queryByTestId } = renderWithProviders(<LockScreenOverlay />);

    expect(queryByTestId("lock-screen-overlay")).toBeNull();
    expect(queryByTestId("lock-screen")).toBeNull();
  });

  it("renders the lock UI above the app when soft-locked", () => {
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.LOCKED,
      isSoftLocked: true,
    });

    const { getByTestId } = renderWithProviders(<LockScreenOverlay />);

    expect(getByTestId("lock-screen-overlay")).toBeTruthy();
    expect(getByTestId("lock-screen")).toBeTruthy();
    expect(getByTestId("unlock-button")).toBeTruthy();
  });

  it("disappears when the wallet is unlocked", () => {
    useAuthenticationStore.setState({
      authStatus: AUTH_STATUS.LOCKED,
      isSoftLocked: true,
    });

    const { getByTestId, queryByTestId } = renderWithProviders(
      <LockScreenOverlay />,
    );
    expect(getByTestId("lock-screen-overlay")).toBeTruthy();

    // Unlock: signIn success resets the store which clears isSoftLocked
    act(() => {
      useAuthenticationStore.setState({
        authStatus: AUTH_STATUS.AUTHENTICATED,
        isSoftLocked: false,
      });
    });

    expect(queryByTestId("lock-screen-overlay")).toBeNull();
  });

  describe("Android Back", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    // Captures the Android back listeners registered, newest last
    const captureBackPresses = () => {
      const listeners: { onBack: () => boolean; remove: jest.Mock }[] = [];
      jest
        .spyOn(BackHandler, "addEventListener")
        .mockImplementation((_event, handler) => {
          const listener = {
            onBack: handler as () => boolean,
            remove: jest.fn(),
          };
          listeners.push(listener);

          return { remove: listener.remove };
        });

      return listeners;
    };

    it("swallows Back while soft-locked", () => {
      const listeners = captureBackPresses();
      useAuthenticationStore.setState({
        authStatus: AUTH_STATUS.LOCKED,
        isSoftLocked: true,
      });

      renderWithProviders(<LockScreenOverlay />);

      expect(listeners).toHaveLength(1);
      // `true` stops React Native there, so Back can't pop the screens
      // hidden underneath or leave the app
      expect(listeners[0].onBack()).toBe(true);
    });

    it("lets Back through again once unlocked", () => {
      const listeners = captureBackPresses();
      useAuthenticationStore.setState({
        authStatus: AUTH_STATUS.LOCKED,
        isSoftLocked: true,
      });
      renderWithProviders(<LockScreenOverlay />);

      act(() => {
        useAuthenticationStore.setState({
          authStatus: AUTH_STATUS.AUTHENTICATED,
          isSoftLocked: false,
        });
      });

      expect(listeners[0].remove).toHaveBeenCalledTimes(1);
    });

    it("doesn't listen while the wallet isn't soft-locked", () => {
      const listeners = captureBackPresses();
      useAuthenticationStore.setState({
        authStatus: AUTH_STATUS.AUTHENTICATED,
        isSoftLocked: false,
      });

      renderWithProviders(<LockScreenOverlay />);

      expect(listeners).toHaveLength(0);
    });
  });
});
