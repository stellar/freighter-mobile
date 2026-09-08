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
      CannotRemoveType: {
        native: "native",
        hasBalance: "hasBalance",
        notLocallyAdded: "notLocallyAdded",
      },
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
  localOnlyTokenIds: [],
  onCancel: jest.fn(),
  onRemoveToken: jest.fn(),
  isRemovingToken: false,
  onDismiss: jest.fn(),
};

const CONTRACT_ID = "CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4";

const makeCustomToken = () =>
  ({
    id: `TKN:${CONTRACT_ID}`,
    tokenCode: "TKN",
    tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    total: new BigNumber(0),
    token: { issuer: { key: CONTRACT_ID } },
  }) as never;

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
      token: { type: TokenTypeWithCustomToken.NATIVE, code: "XLM" },
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

  it("shows the hasBalance cannot-remove sheet for a zero-balance LP-share token", () => {
    const token = makeToken({
      total: new BigNumber(0),
      tokenType: TokenTypeWithCustomToken.LIQUIDITY_POOL_SHARES,
    });
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

  it("shows the notLocallyAdded sheet for a contract token the backend reports itself", () => {
    // Dropping the local entry would not stop the backend returning it, so the
    // token would reappear on the next poll — hide-only instead.
    const { getByText } = render(
      <RemoveTokenSheetContent
        {...baseProps}
        selectedToken={makeCustomToken()}
        localOnlyTokenIds={[]}
      />,
    );
    expect(getByText("cannot-notLocallyAdded")).toBeTruthy();
  });

  it("shows the removable content for a locally added contract token", () => {
    const { getByText } = render(
      <RemoveTokenSheetContent
        {...baseProps}
        selectedToken={makeCustomToken()}
        localOnlyTokenIds={[CONTRACT_ID]}
      />,
    );
    expect(getByText("remove-content")).toBeTruthy();
  });

  it("keeps a zero-balance classic trustline removable regardless of the local list", () => {
    // Removing a trustline is a real changeTrust operation, not a local-list
    // edit, so the local-only gate must not apply to it.
    const { getByText } = render(
      <RemoveTokenSheetContent
        {...baseProps}
        selectedToken={makeToken({ total: new BigNumber(0) })}
        localOnlyTokenIds={[]}
      />,
    );
    expect(getByText("remove-content")).toBeTruthy();
  });
});
