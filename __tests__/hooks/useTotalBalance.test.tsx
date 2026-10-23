import { renderHook } from "@testing-library/react-hooks";
import { BigNumber } from "bignumber.js";
import { useTotalBalance } from "hooks/useTotalBalance";

const USDC_ID = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const SPAM_ID = "SPAM:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHDAD2NQMLQ5AE";

let mockBalancesState: Record<string, unknown> = {};

jest.mock("ducks/balances", () => ({
  useBalancesStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockBalancesState),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: (selector: (state: { network: string }) => unknown) =>
    selector({ network: "PUBLIC" }),
}));

describe("useTotalBalance", () => {
  beforeEach(() => {
    mockBalancesState = {
      pricedBalances: {
        XLM: { fiatTotal: new BigNumber("50") },
        [USDC_ID]: { fiatTotal: new BigNumber("25") },
        [SPAM_ID]: { fiatTotal: new BigNumber("1000000") },
      },
      hiddenTokenIds: [],
      isFunded: true,
      error: null,
    };
  });

  it("sums every priced token when nothing is hidden", () => {
    const { result } = renderHook(() => useTotalBalance());

    expect(result.current.rawBalance.toString()).toBe("1000075");
  });

  it("leaves hidden tokens out of the total", () => {
    mockBalancesState = { ...mockBalancesState, hiddenTokenIds: [SPAM_ID] };

    const { result } = renderHook(() => useTotalBalance());

    expect(result.current.rawBalance.toString()).toBe("75");
    expect(result.current.hasFiatTotal).toBe(true);
  });

  it("treats a total made only of hidden tokens as unpriced", () => {
    mockBalancesState = {
      ...mockBalancesState,
      pricedBalances: { [SPAM_ID]: { fiatTotal: new BigNumber("1") } },
      hiddenTokenIds: [SPAM_ID],
    };

    const { result } = renderHook(() => useTotalBalance());

    expect(result.current.rawBalance.toString()).toBe("0");
    expect(result.current.hasFiatTotal).toBe(false);
  });
});
