import { act } from "@testing-library/react-native";
import { LockScreenOverlay } from "components/LockScreenOverlay";
import { AUTH_STATUS } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("ducks/auth", () => {
  const actual = jest.requireActual("ducks/auth");
  return {
    ...actual,
    getActiveAccountPublicKey: jest.fn().mockResolvedValue(null),
  };
});

jest.mock("services/autoLock", () => ({
  persistAutoLockTimer: jest.fn().mockResolvedValue(undefined),
  applyAutoLockTimerToHashKey: jest.fn().mockResolvedValue(undefined),
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
});
