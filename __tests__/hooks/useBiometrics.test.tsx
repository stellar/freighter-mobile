import { renderHook } from "@testing-library/react-hooks";
import React from "react";

// jest.setup mocks this hook for every other suite; this one is about the real
// implementation, so it opts back in.
jest.unmock("hooks/useBiometrics");

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    signInMethod: "face",
    setSignInMethod: jest.fn(),
  }),
}));

jest.mock("ducks/preferences", () => ({
  usePreferencesStore: () => ({
    isBiometricsEnabled: true,
    setIsBiometricsEnabled: jest.fn(),
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
const { useBiometrics } = require("hooks/useBiometrics");

const iconFrom = (color?: string) => {
  const { result } = renderHook(() => useBiometrics());

  return result.current.getBiometricButtonIcon(color) as React.ReactElement<{
    color?: string;
  }>;
};

describe("useBiometrics", () => {
  it("leaves the button icon uncolored so the Button can tint it", () => {
    // Button colors its icon to match its own label. An icon that arrives
    // already colored keeps that color, so defaulting one here would pin the
    // biometric icon to a single shade across every variant.
    expect(iconFrom().props.color).toBeUndefined();
  });

  it("still honours a color the caller asks for", () => {
    expect(iconFrom("#ff0000").props.color).toBe("#ff0000");
  });
});
