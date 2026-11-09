import { renderHook } from "@testing-library/react-hooks";
import { BigNumber } from "bignumber.js";
import { NETWORKS } from "config/constants";
import { useBalancesList } from "hooks/useBalancesList";

// jest.setup.js stubs this hook for screen tests; this file tests the real one.
jest.unmock("hooks/useBalancesList");

const USDC_ID = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const KALE_ID = "KALE:GBDVX4VELCDSQ54KQJYTNHXAHFLBCA77ZY2USQBM4CSHDAD2NQMLQ5AE";

let mockBalancesState: Record<string, unknown> = {};

jest.mock("ducks/balances", () => ({
  useBalancesStore: () => mockBalancesState,
}));

const makeBalance = (code: string) => ({
  token: { code, type: "credit_alphanum4" },
  tokenCode: code,
  displayName: code,
  total: new BigNumber("10"),
  available: new BigNumber("10"),
});

describe("useBalancesList", () => {
  beforeEach(() => {
    mockBalancesState = {
      pricedBalances: {
        XLM: {
          ...makeBalance("XLM"),
          token: { code: "XLM", type: "native" },
          displayName: "Stellar Lumens",
        },
        [USDC_ID]: makeBalance("USDC"),
        [KALE_ID]: makeBalance("KALE"),
      },
      scanResults: {},
      isLoading: false,
      error: null,
      isFunded: true,
      localOnlyTokenIds: [],
      hiddenTokenIds: [KALE_ID],
      fetchAccountBalances: jest.fn(),
    };
  });

  const renderList = (overrides = {}) =>
    renderHook(() =>
      useBalancesList({
        publicKey: "GABC",
        network: NETWORKS.PUBLIC,
        ...overrides,
      }),
    );

  it("leaves hidden tokens out of balanceItems by default", () => {
    const { result } = renderList();

    expect(result.current.balanceItems.map((item) => item.id)).toEqual([
      "XLM",
      USDC_ID,
    ]);
  });

  it("exposes the hidden tokens separately", () => {
    const { result } = renderList();

    expect(result.current.hiddenBalanceItems.map((item) => item.id)).toEqual([
      KALE_ID,
    ]);
  });

  it("keeps hidden tokens in balanceItems when includeHidden is set", () => {
    const { result } = renderList({ includeHidden: true });

    expect(result.current.balanceItems.map((item) => item.id)).toEqual([
      "XLM",
      USDC_ID,
      KALE_ID,
    ]);
  });

  it("applies the search term after the hidden filter", () => {
    const { result } = renderList({ searchTerm: "kale" });

    expect(result.current.balanceItems).toEqual([]);
  });
});
