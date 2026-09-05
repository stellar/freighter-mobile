/* eslint-disable global-require, @typescript-eslint/no-var-requires, react/react-in-jsx-scope */
import { render } from "@testing-library/react-native";
import TokenItem from "components/screens/AddTokenScreen/TokenItem";
import {
  TokenTypeWithCustomToken,
  FormattedSearchTokenRecord,
} from "config/types";
import React from "react";

jest.mock("hooks/useAppTranslation", () => () => ({
  t: () => "Stellar Network",
}));

jest.mock("components/TokenIconWithBadge", () => {
  const { View } = require("react-native");
  return {
    TokenIconWithBadge: () => <View testID="token-icon-with-badge" />,
  };
});

jest.mock("components/screens/AddTokenScreen/AddTokenRightContent", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: () => <View testID="add-token-right-content" />,
  };
});

jest.mock("components/ManageTokenRightContent", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: ({ token }: { token: { isNative: boolean; id: string } }) => (
      <View
        testID="manage-token-right-content"
        // Expose the props the mocked child received so tests can assert on
        // them without reaching into the real component's internals.
        accessibilityValue={{ text: JSON.stringify(token) }}
      />
    ),
  };
});

const makeToken = (
  overrides: Partial<FormattedSearchTokenRecord>,
): FormattedSearchTokenRecord => ({
  tokenCode: "USDC",
  domain: "example.com",
  hasTrustline: false,
  issuer: "GAABBCCDDEEFF",
  isNative: false,
  tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
  ...overrides,
});

describe("TokenItem", () => {
  const handleAddToken = jest.fn();
  const handleRemoveToken = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the Stellar Network label for the native record instead of a dash", () => {
    const token = makeToken({
      isNative: true,
      tokenCode: "XLM",
      domain: "",
      issuer: "",
      hasTrustline: true,
    });

    const { getByText, queryByText } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(getByText("Stellar Network")).toBeTruthy();
    expect(queryByText("-")).toBeNull();
  });

  it("renders the token's domain unchanged when present", () => {
    const token = makeToken({ domain: "example.com" });

    const { getByText } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(getByText("example.com")).toBeTruthy();
  });

  it("renders a dash for a non-native record with an empty domain", () => {
    const token = makeToken({ domain: "" });

    const { getByText } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(getByText("-")).toBeTruthy();
  });

  it("passes the bare token code as the id for the native record", () => {
    const token = makeToken({
      isNative: true,
      tokenCode: "XLM",
      issuer: "",
      hasTrustline: true,
    });

    const { getByTestId } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    const received = getByTestId("manage-token-right-content");
    expect(JSON.parse(received.props.accessibilityValue.text)).toEqual({
      isNative: true,
      id: "XLM",
    });
  });

  it("passes CODE:ISSUER as the id for a non-native held record", () => {
    const token = makeToken({
      isNative: false,
      tokenCode: "USDC",
      issuer: "GAABBCCDDEEFF",
      hasTrustline: true,
    });

    const { getByTestId } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    const received = getByTestId("manage-token-right-content");
    expect(JSON.parse(received.props.accessibilityValue.text)).toEqual({
      isNative: false,
      id: "USDC:GAABBCCDDEEFF",
    });
  });

  it("renders a custom token's name when it has no domain", () => {
    const token = makeToken({
      domain: "",
      name: "Aquarius",
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    });

    const { getByText } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(getByText("Aquarius")).toBeTruthy();
  });

  it("prefers the domain over the name for a custom token when both are present", () => {
    const token = makeToken({
      domain: "example.com",
      name: "Aquarius",
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    });

    const { getByText, queryByText } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(getByText("example.com")).toBeTruthy();
    expect(queryByText("Aquarius")).toBeNull();
  });

  it("renders a dash for a custom token with neither a domain nor a name", () => {
    const token = makeToken({
      domain: "",
      name: undefined,
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    });

    const { getByText } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(getByText("-")).toBeTruthy();
  });

  it("renders a Stellar Asset Contract's token code instead of its canonical name", () => {
    const token = makeToken({
      tokenCode: "USDC",
      domain: "",
      name: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    });

    const { getAllByText, queryByText } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(
      queryByText(
        "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      ),
    ).toBeNull();
    // The token code appears twice: once as the title, once as the
    // contract-resolved asset's subtitle stand-in for its canonical name.
    expect(getAllByText("USDC")).toHaveLength(2);
  });

  it("re-renders the subtitle when the domain changes but the code and issuer do not", () => {
    const token = makeToken({ domain: "" });

    const { getByText, queryByText, rerender } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(getByText("-")).toBeTruthy();

    const updatedToken = makeToken({ domain: "centre.io" });

    rerender(
      <TokenItem
        token={updatedToken}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(getByText("centre.io")).toBeTruthy();
    expect(queryByText("-")).toBeNull();
  });

  it("re-renders the right-side content when hasTrustline flips but the code and issuer do not", () => {
    const token = makeToken({ hasTrustline: false });

    const { getByTestId, queryByTestId, rerender } = render(
      <TokenItem
        token={token}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(getByTestId("add-token-right-content")).toBeTruthy();
    expect(queryByTestId("manage-token-right-content")).toBeNull();

    const updatedToken = makeToken({ hasTrustline: true });

    rerender(
      <TokenItem
        token={updatedToken}
        handleAddToken={handleAddToken}
        handleRemoveToken={handleRemoveToken}
      />,
    );

    expect(getByTestId("manage-token-right-content")).toBeTruthy();
    expect(queryByTestId("add-token-right-content")).toBeNull();
  });
});
