/* eslint-disable @fnando/consistent-import/consistent-import */
import { render } from "@testing-library/react-native";
import { TokenContextMenu } from "components/screens/SwapScreen/components/TokenContextMenu";
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
  it("accepts a PricedBalance-like token (held)", () => {
    const heldToken = {
      id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      tokenCode: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    };
    expect(() =>
      render(<TokenContextMenu token={heldToken} network={NETWORKS.PUBLIC} />),
    ).not.toThrow();
  });

  it("accepts a FormattedSearchTokenRecord-like token (non-held)", () => {
    const searchToken = {
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
    const contractToken = {
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
});
