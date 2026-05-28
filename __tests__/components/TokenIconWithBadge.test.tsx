/* eslint-disable global-require, @typescript-eslint/no-var-requires, react/react-in-jsx-scope */
import { render } from "@testing-library/react-native";
import { TokenIconWithBadge } from "components/TokenIconWithBadge";
import { TokenTypeWithCustomToken } from "config/types";
import React from "react";
import { SecurityLevel } from "services/blockaid/constants";

// Mock TokenIcon to avoid deep dependency rendering
jest.mock("components/TokenIcon", () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const React = require("react");
  const { View } = require("react-native");
  return {
    TokenIcon: () => <View testID="token-icon" />,
  };
});

// Mock Icon to capture AlertCircle usage
jest.mock("components/sds/Icon", () => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const React = require("react");
  const { View } = require("react-native");
  const AlertCircle = ({ themeColor }: { themeColor?: string }) => (
    <View testID={`alert-circle-${themeColor}`} />
  );
  return {
    __esModule: true,
    default: { AlertCircle },
  };
});

const mockToken = {
  type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  code: "USDC",
  issuer: { key: "GA5Z..." },
};

describe("TokenIconWithBadge", () => {
  it("renders the icon with no badge when securityLevel is SAFE", () => {
    const { queryByTestId } = render(
      <TokenIconWithBadge
        token={mockToken}
        securityLevel={SecurityLevel.SAFE}
      />,
    );
    expect(queryByTestId("token-icon-badge")).toBeNull();
  });

  it("renders the icon with no badge when securityLevel is undefined", () => {
    const { queryByTestId } = render(<TokenIconWithBadge token={mockToken} />);
    expect(queryByTestId("token-icon-badge")).toBeNull();
  });

  it("renders a badge when securityLevel is SUSPICIOUS", () => {
    const { getByTestId } = render(
      <TokenIconWithBadge
        token={mockToken}
        securityLevel={SecurityLevel.SUSPICIOUS}
      />,
    );
    expect(getByTestId("token-icon-badge")).toBeTruthy();
  });

  it("renders a badge when securityLevel is MALICIOUS", () => {
    const { getByTestId } = render(
      <TokenIconWithBadge
        token={mockToken}
        securityLevel={SecurityLevel.MALICIOUS}
      />,
    );
    expect(getByTestId("token-icon-badge")).toBeTruthy();
  });

  it("renders no badge when securityLevel is UNABLE_TO_SCAN", () => {
    const { queryByTestId } = render(
      <TokenIconWithBadge
        token={mockToken}
        securityLevel={SecurityLevel.UNABLE_TO_SCAN}
      />,
    );
    expect(queryByTestId("token-icon-badge")).toBeNull();
  });

  it("uses amber color for SUSPICIOUS level", () => {
    const { getByTestId } = render(
      <TokenIconWithBadge
        token={mockToken}
        securityLevel={SecurityLevel.SUSPICIOUS}
      />,
    );
    expect(getByTestId("alert-circle-amber")).toBeTruthy();
  });

  it("uses red color for MALICIOUS level", () => {
    const { getByTestId } = render(
      <TokenIconWithBadge
        token={mockToken}
        securityLevel={SecurityLevel.MALICIOUS}
      />,
    );
    expect(getByTestId("alert-circle-red")).toBeTruthy();
  });
});
