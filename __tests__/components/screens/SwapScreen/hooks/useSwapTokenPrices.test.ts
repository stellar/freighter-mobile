/* eslint-disable @fnando/consistent-import/consistent-import */
import { renderHook } from "@testing-library/react-native";
import { useSwapTokenPrices } from "components/screens/SwapScreen/hooks/useSwapTokenPrices";
import type { FormattedSearchTokenRecord } from "config/types";

import { CONTRACT, ISSUER } from "../../../../../__mocks__/swapFixtures";

const mockFetchPricesForTokenIds = jest.fn();

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: (selector: (s: { network: string }) => unknown) =>
    selector({ network: "PUBLIC" }),
}));
jest.mock("ducks/remoteConfig", () => ({
  useRemoteConfigStore: (
    selector: (s: { use_token_prices_v2: boolean }) => unknown,
  ) => selector({ use_token_prices_v2: true }),
}));
jest.mock("ducks/prices", () => ({
  usePricesStore: (selector: (s: unknown) => unknown) =>
    selector({ fetchPricesForTokenIds: mockFetchPricesForTokenIds }),
  usePricesForNetwork: () => ({}),
}));

describe("useSwapTokenPrices", () => {
  beforeEach(() => jest.clearAllMocks());

  it("does not ask at all when the only token is a Soroban one", () => {
    renderHook(() =>
      useSwapTokenPrices({
        enabled: false,
        tokens: [],
        extraTokenIds: [`deJTRSY:${CONTRACT}`],
      }),
    );

    expect(mockFetchPricesForTokenIds).not.toHaveBeenCalled();
  });

  it("prices the classic tokens of the trending list and the extra ids together and skips a Soroban extra", () => {
    renderHook(() =>
      useSwapTokenPrices({
        enabled: true,
        tokens: [
          { tokenCode: "USDC", issuer: ISSUER },
        ] as FormattedSearchTokenRecord[],
        extraTokenIds: [`deJTRSY:${CONTRACT}`, `EURC:${ISSUER}`],
      }),
    );

    expect(mockFetchPricesForTokenIds).toHaveBeenCalledTimes(1);
    expect(mockFetchPricesForTokenIds).toHaveBeenCalledWith(
      expect.objectContaining({
        tokens: [`USDC:${ISSUER}`, `EURC:${ISSUER}`],
      }),
    );
  });
});
