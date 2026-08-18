/* eslint-disable @fnando/consistent-import/consistent-import */
import { render } from "@testing-library/react-native";
import { TokenContextMenu } from "components/screens/SwapScreen/components/TokenContextMenu";
import {
  getContractAddress,
  TokenReference,
} from "components/screens/SwapScreen/helpers";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import React from "react";

import { mockUseColors } from "../../../../../__mocks__/use-colors";

mockUseColors();

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => key,
}));

jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: jest.fn(),
  }),
}));

jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({
    open: jest.fn(),
  }),
}));

jest.mock("components/ContextMenuButton", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("helpers/soroban", () => ({
  getNativeContractDetails: () => ({ contract: "CNATIVE..." }),
}));

describe("TokenContextMenu — widened prop shape", () => {
  it("accepts a PricedBalance-like token with nested token.issuer.key", () => {
    const heldToken: TokenReference = {
      id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      tokenCode: "USDC",
      token: {
        issuer: {
          key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
      },
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    };
    expect(() =>
      render(<TokenContextMenu token={heldToken} network={NETWORKS.PUBLIC} />),
    ).not.toThrow();
  });

  it("accepts a FormattedSearchTokenRecord-like token (non-held)", () => {
    const searchToken: TokenReference = {
      tokenCode: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    };
    expect(() =>
      render(
        <TokenContextMenu token={searchToken} network={NETWORKS.PUBLIC} />,
      ),
    ).not.toThrow();
  });

  it("accepts a contract-id reference (Soroban)", () => {
    const contractToken: TokenReference = {
      contractId: "CABC123...",
      tokenCode: "CUSTOM",
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    };
    expect(() =>
      render(
        <TokenContextMenu token={contractToken} network={NETWORKS.PUBLIC} />,
      ),
    ).not.toThrow();
  });

  it("accepts a native XLM token (id='native')", () => {
    const nativeToken: TokenReference = {
      id: "native",
      tokenCode: "XLM",
      tokenType: TokenTypeWithCustomToken.NATIVE,
    };
    expect(() =>
      render(
        <TokenContextMenu token={nativeToken} network={NETWORKS.PUBLIC} />,
      ),
    ).not.toThrow();
  });
});

describe("getContractAddress — branch coverage", () => {
  it("returns contractId for Soroban references (branch 1)", () => {
    const balance: TokenReference = {
      contractId: "CABC123...",
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
    };
    expect(getContractAddress({ balance, network: NETWORKS.PUBLIC })).toBe(
      "CABC123...",
    );
  });

  it("returns nested token.issuer.key for PricedBalance shape (branch 2)", () => {
    const balance: TokenReference = {
      id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      token: {
        issuer: {
          key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        },
      },
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    };
    expect(getContractAddress({ balance, network: NETWORKS.PUBLIC })).toBe(
      "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    );
  });

  it("returns flat issuer for FormattedSearchTokenRecord shape (branch 3)", () => {
    const balance: TokenReference = {
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    };
    expect(getContractAddress({ balance, network: NETWORKS.PUBLIC })).toBe(
      "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    );
  });

  it("returns the native contract address for id='native' (branch 4)", () => {
    const balance: TokenReference = {
      id: "native",
      tokenType: TokenTypeWithCustomToken.NATIVE,
    };
    // getNativeContractDetails is mocked above to return { contract: "CNATIVE..." }
    expect(getContractAddress({ balance, network: NETWORKS.PUBLIC })).toBe(
      "CNATIVE...",
    );
  });

  it("returns null for an empty/unknown token reference", () => {
    const balance: TokenReference = {};
    expect(
      getContractAddress({ balance, network: NETWORKS.PUBLIC }),
    ).toBeNull();
  });
});
