/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import { useReviewTokens } from "components/screens/SwapScreen/hooks/useReviewTokens";
import { TokenTypeWithCustomToken } from "config/types";

import { CONTRACT } from "../../../../../__mocks__/swapFixtures";

let mockStorePrices: Record<string, unknown> = {};

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: (selector: (s: { network: string }) => unknown) =>
    selector({ network: "PUBLIC" }),
}));
jest.mock("ducks/prices", () => ({
  usePricesForNetwork: () => mockStorePrices,
}));

const descriptor = (priceUsd?: number) => ({
  id: `deJTRSY:${CONTRACT}`,
  tokenCode: "deJTRSY",
  issuer: CONTRACT,
  decimals: 18,
  tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
  requiresTrustline: false,
  priceUsd,
});

const render = (priceUsd?: number, overrides: Record<string, unknown> = {}) =>
  renderHook(() =>
    useReviewTokens({
      balanceItems: [],
      sourceTokenId: "",
      sourceAmount: "10",
      destinationAmount: "5",
      destinationTokenDescriptor: descriptor(priceUsd),
      pathResult: null,
      ...overrides,
    } as never),
  );

describe("useReviewTokens — a bought Soroban token the wallet does not hold", () => {
  beforeEach(() => {
    mockStorePrices = {};
  });

  it("builds the token from the descriptor, with the contract in the issuer's place", () => {
    const { result } = render(1.02);

    expect(result.current.destinationToken).toEqual({
      type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      code: "deJTRSY",
      issuer: { key: CONTRACT },
    });
  });

  it("values it at the picker's price when the prices store has none", () => {
    const { result } = render(1.02);

    expect(result.current.destinationTokenFiatAmount).toBe("$5.10");
  });

  it("prefers a price the prices store does have", () => {
    mockStorePrices = {
      [`deJTRSY:${CONTRACT}`]: { currentPrice: 2 },
    };

    const { result } = render(1.02);

    expect(result.current.destinationTokenFiatAmount).toBe("$10.00");
  });

  it("shows no value when nothing prices it", () => {
    const { result } = render(undefined);

    expect(result.current.destinationTokenFiatAmount).toBe("--");
  });
});
