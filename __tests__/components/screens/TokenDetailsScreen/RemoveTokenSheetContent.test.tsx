/* eslint-disable global-require, @typescript-eslint/no-var-requires */
import { render } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import { RemoveTokenSheetContent } from "components/screens/TokenDetailsScreen/components/RemoveTokenSheetContent";
import { TokenTypeWithCustomToken } from "config/types";
import React from "react";

jest.mock(
  "components/screens/AddTokenScreen/CannotRemoveTokenBottomSheet",
  () => {
    const { Text } = require("react-native");
    return {
      __esModule: true,
      CannotRemoveType: { native: "native", hasBalance: "hasBalance" },
      default: ({ type }: { type: string }) => <Text>{`cannot-${type}`}</Text>,
    };
  },
);

jest.mock("components/screens/AddTokenScreen/RemoveTokenBottomSheet", () => {
  const { Text } = require("react-native");
  return {
    __esModule: true,
    default: () => <Text>remove-content</Text>,
  };
});

const baseProps = {
  account: null,
  onCancel: jest.fn(),
  onRemoveToken: jest.fn(),
  isRemovingToken: false,
  onDismiss: jest.fn(),
};

const makeToken = (over: Record<string, unknown>) =>
  ({
    id: "USDC:GA123",
    tokenCode: "USDC",
    tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    total: new BigNumber(0),
    token: { issuer: { key: "GA123" } },
    ...over,
  }) as never;

describe("RemoveTokenSheetContent", () => {
  it("shows the native cannot-remove sheet for XLM", () => {
    const token = makeToken({
      id: "XLM",
      tokenCode: "XLM",
      tokenType: TokenTypeWithCustomToken.NATIVE,
      token: {},
    });
    const { getByText } = render(
      <RemoveTokenSheetContent {...baseProps} selectedToken={token} />,
    );
    expect(getByText("cannot-native")).toBeTruthy();
  });

  it("shows the hasBalance cannot-remove sheet for a token with balance", () => {
    const token = makeToken({ total: new BigNumber(10) });
    const { getByText } = render(
      <RemoveTokenSheetContent {...baseProps} selectedToken={token} />,
    );
    expect(getByText("cannot-hasBalance")).toBeTruthy();
  });

  it("shows the removable content for a zero-balance non-native token", () => {
    const token = makeToken({ total: new BigNumber(0) });
    const { getByText } = render(
      <RemoveTokenSheetContent {...baseProps} selectedToken={token} />,
    );
    expect(getByText("remove-content")).toBeTruthy();
  });
});
