/* eslint-disable @fnando/consistent-import/consistent-import */
import { act, renderHook } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import { SWAP_TOAST_IDS } from "components/screens/SwapScreen/hooks/useSwapAmountError";
import { useSwapFeeShortfall } from "components/screens/SwapScreen/hooks/useSwapFeeShortfall";
import { useSwapQuoteFees } from "components/screens/SwapScreen/hooks/useSwapQuoteFees";
import { NETWORKS } from "config/constants";
import { swapPairKey, swapQuoteKey, useSwapStore } from "ducks/swap";
import { calculateSpendableAmount } from "helpers/balances";

jest.mock("hooks/useAppTranslation", () => {
  const stableTranslation = { t: (key: string) => key };
  return {
    __esModule: true,
    default: () => stableTranslation,
  };
});

jest.mock("helpers/balances", () => ({
  ...jest.requireActual("helpers/balances"),
  calculateSpendableAmount: jest.fn(),
}));

const mockCalc = calculateSpendableAmount as jest.Mock;

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const xlm = { id: "XLM", token: { type: "native", code: "XLM" } } as never;
const usdc = {
  id: `USDC:${USDC_ISSUER}`,
  token: {
    type: "credit_alphanum4",
    code: "USDC",
    issuer: { key: USDC_ISSUER },
  },
} as never;

const inputs = {
  sourceBalance: xlm,
  destinationBalance: usdc,
  sourceAmount: "10",
  network: NETWORKS.PUBLIC,
  publicKey: "GTESTPUBLICKEY",
};

const route = (resourceFee?: string) => ({
  source: "lifi",
  fromAmount: "10",
  toAmount: "2",
  paths: [],
  fees: [],
  ...(resourceFee ? { resourceFee } : {}),
});

const quoteFor = (quoteKey: string, resourceFee: string) => ({
  pathResult: {
    sourceAmount: "10",
    destinationAmount: "2",
    route: route(resourceFee),
    conversionRate: "0.2",
    quoteKey,
  },
  swapQuotes: { routes: [route(resourceFee)], unavailable: [] },
});

describe("useSwapQuoteFees", () => {
  beforeEach(() => {
    act(() => {
      useSwapStore.getState().resetSwap();
    });
  });

  const renderFees = () =>
    renderHook(() => useSwapQuoteFees({ ...inputs, swapFee: "0.001" })).result
      .current;

  it("adds the current quote's resource fee to the swap's fee", () => {
    act(() => {
      useSwapStore.setState(
        quoteFor(swapQuoteKey(inputs) ?? "", "0.5") as never,
      );
    });

    const fees = renderFees();

    expect(fees.isQuoteCurrent).toBe(true);
    expect(fees.resourceFee).toBe("0.5");
    expect(fees.totalFee).toBe("0.501");
    expect(fees.spendableFee).toBe("0.501");
  });

  // Max changes the amount, so the quote it lands on is a new one.
  it("sizes the spendable amount with the pair's last fee until a quote answers these inputs", () => {
    act(() => {
      useSwapStore.setState({
        lastResourceFee: { pairKey: swapPairKey(inputs) ?? "", fee: "0.3" },
      });
    });

    const fees = renderFees();

    expect(fees.isQuoteCurrent).toBe(false);
    expect(fees.totalFee).toBe("0.001");
    expect(fees.spendableFee).toBe("0.301");
  });

  it("doesn't count a quote for other inputs", () => {
    act(() => {
      useSwapStore.setState(quoteFor("other-inputs", "0.5") as never);
    });

    const fees = renderFees();

    expect(fees.isQuoteCurrent).toBe(false);
    expect(fees.totalFee).toBe("0.001");
  });
});

describe("useSwapFeeShortfall", () => {
  beforeEach(() => {
    mockCalc.mockReset();
  });

  const renderShortfall = (
    overrides: Partial<Parameters<typeof useSwapFeeShortfall>[0]> = {},
  ) => {
    const setActiveError = jest.fn();
    const { result } = renderHook(() =>
      useSwapFeeShortfall({
        resourceFee: "0.5",
        totalFee: "0.501",
        sourceBalance: usdc,
        balanceItems: [xlm],
        subentryCount: 1,
        transactionHash: null,
        setActiveError,
        ...overrides,
      }),
    );
    return { lacksXlm: result.current, setActiveError };
  };

  it("flags a non-XLM source whose XLM can't pay a Soroban route's whole fee", () => {
    mockCalc.mockReturnValue(new BigNumber("0.2"));

    const { lacksXlm, setActiveError } = renderShortfall();

    expect(lacksXlm).toBe(true);
    expect(setActiveError).toHaveBeenCalledWith(
      expect.objectContaining({
        toastId: SWAP_TOAST_IDS.INSUFFICIENT_XLM_FOR_FEES,
      }),
    );
  });

  it("is satisfied when the XLM covers it", () => {
    mockCalc.mockReturnValue(new BigNumber("2"));

    const { lacksXlm, setActiveError } = renderShortfall();

    expect(lacksXlm).toBe(false);
    expect(setActiveError).not.toHaveBeenCalled();
  });

  // An XLM source's spendable amount already nets the fee out.
  it("leaves an XLM source to its spendable amount", () => {
    mockCalc.mockReturnValue(new BigNumber("0.2"));

    expect(renderShortfall({ sourceBalance: xlm }).lacksXlm).toBe(false);
  });

  it("has nothing to check on a route without a resource fee", () => {
    mockCalc.mockReturnValue(new BigNumber("0"));

    expect(renderShortfall({ resourceFee: undefined }).lacksXlm).toBe(false);
  });
});
