/* eslint-disable @fnando/consistent-import/consistent-import */
import { act, renderHook } from "@testing-library/react-hooks";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers";
import { TokenTypeWithCustomToken } from "config/types";
import {
  useSwapStore,
  descriptorAsPathBalance,
  SwapPathResult,
  isStaleAggregatorQuote,
  AGGREGATOR_QUOTE_MAX_AGE_MS,
} from "ducks/swap";
import { SwapQuoteSource } from "services/backend";

import { CONTRACT, ISSUER } from "../../__mocks__/swapFixtures";

describe("useSwapStore — destinationToken migration", () => {
  beforeEach(() => {
    act(() => {
      useSwapStore.getState().resetSwap();
    });
  });

  it("has destinationToken: null in initial state (legacy fields removed)", () => {
    const { result } = renderHook(() => useSwapStore());

    expect(result.current.destinationToken).toBeNull();
    expect((result.current as any).destinationTokenId).toBeUndefined();
    expect((result.current as any).destinationTokenSymbol).toBeUndefined();
  });

  it("setDestinationToken stores the descriptor verbatim", () => {
    const { result } = renderHook(() => useSwapStore());

    const descriptor: DestinationTokenDescriptor = {
      id: "USDC:GA5Z...",
      tokenCode: "USDC",
      issuer: "GA5Z...",
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      requiresTrustline: true,
    };

    act(() => {
      result.current.setDestinationToken(descriptor);
    });

    expect(result.current.destinationToken).toEqual(descriptor);
  });

  it("resetSwap clears destinationToken", () => {
    const { result } = renderHook(() => useSwapStore());

    act(() => {
      result.current.setDestinationToken({
        id: "native",
        tokenCode: "XLM",
        decimals: 7,
        tokenType: TokenTypeWithCustomToken.NATIVE,
        requiresTrustline: false,
      });
    });
    act(() => {
      result.current.resetSwap();
    });

    expect(result.current.destinationToken).toBeNull();
  });
});

describe("useSwapStore — setSourceToken amount reset", () => {
  beforeEach(() => {
    act(() => {
      useSwapStore.getState().resetSwap();
    });
  });

  it("resets the amount when switching to a different source token", () => {
    const { result } = renderHook(() => useSwapStore());

    act(() => {
      result.current.setSourceToken("USDC:GA5Z...", "USDC");
      result.current.setSourceAmount("100");
    });
    expect(result.current.sourceAmount).toBe("100");
    expect(result.current.sourceAmountDisplay).toBe("100");

    act(() => {
      result.current.setSourceToken("XLM", "XLM");
    });

    expect(result.current.sourceTokenId).toBe("XLM");
    expect(result.current.sourceTokenSymbol).toBe("XLM");
    expect(result.current.sourceAmount).toBe("0");
    expect(result.current.sourceAmountDisplay).toBe("0");
  });

  it("preserves the amount when re-picking the same source token", () => {
    const { result } = renderHook(() => useSwapStore());

    act(() => {
      result.current.setSourceToken("USDC:GA5Z...", "USDC");
      result.current.setSourceAmount("100");
    });

    act(() => {
      // Re-picking the current source (e.g. tapping it again in the
      // picker) must not wipe an in-progress amount.
      result.current.setSourceToken("USDC:GA5Z...", "USDC");
    });

    expect(result.current.sourceAmount).toBe("100");
    expect(result.current.sourceAmountDisplay).toBe("100");
  });
});

describe("descriptorAsPathBalance", () => {
  it("throws on a native descriptor (XLM should always resolve to a held balance before this projector runs)", () => {
    expect(() =>
      descriptorAsPathBalance({
        id: "native",
        tokenCode: "XLM",
        decimals: 7,
        tokenType: TokenTypeWithCustomToken.NATIVE,
        requiresTrustline: false,
      }),
    ).toThrow(/native descriptor/);
  });

  it("projects a classic descriptor", () => {
    const result = descriptorAsPathBalance({
      id: "USDC:GA5Z...",
      tokenCode: "USDC",
      issuer: "GA5Z...",
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      requiresTrustline: true,
    });

    expect((result as any).token).toEqual({
      code: "USDC",
      issuer: { key: "GA5Z..." },
      type: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
    });
  });

  it("throws when a non-native descriptor is missing issuer", () => {
    expect(() =>
      descriptorAsPathBalance({
        id: "USDC:GA5Z...",
        tokenCode: "USDC",
        // issuer intentionally omitted
        decimals: 7,
        tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
        requiresTrustline: true,
      }),
    ).toThrow(/missing issuer/);
  });
});

describe("descriptorAsPathBalance — Soroban tokens", () => {
  it("carries the contract and decimals a Soroban token declares", () => {
    const shim = descriptorAsPathBalance({
      id: `deJTRSY:${CONTRACT}`,
      tokenCode: "deJTRSY",
      issuer: CONTRACT,
      decimals: 18,
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      requiresTrustline: false,
    }) as any;

    expect(shim.contractId).toBe(CONTRACT);
    expect(shim.decimals).toBe(18);
    expect(shim.symbol).toBe("deJTRSY");
    expect(shim.token.issuer.key).toBe(CONTRACT);
  });

  it("leaves a classic asset without decimals, which is how the converter tells them apart", () => {
    const shim = descriptorAsPathBalance({
      id: `USDC:${ISSUER}`,
      tokenCode: "USDC",
      issuer: ISSUER,
      decimals: 7,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      requiresTrustline: true,
    }) as any;

    expect(shim).not.toHaveProperty("decimals");
    expect(shim).not.toHaveProperty("contractId");
  });
});

const freshnessPath = (over: Partial<SwapPathResult> = {}): SwapPathResult => ({
  sourceAmount: "10",
  destinationAmount: "2.3",
  destinationAmountMin: "2.277",
  path: [],
  conversionRate: "0.23",
  source: SwapQuoteSource.XOXNO,
  quotedAt: 1_000,
  aggregatorTransaction: {
    envelopeXdr: "xdr",
    feeStroops: "100",
    resourceFeeStroops: "0",
    expiresAt: Math.floor(Date.now() / 1000) + 180,
  },
  ...over,
});

describe("isStaleAggregatorQuote", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    [
      "an aggregator quote past the limit",
      true,
      {},
      AGGREGATOR_QUOTE_MAX_AGE_MS + 1,
    ],
    [
      "an aggregator quote exactly at the limit",
      false,
      {},
      AGGREGATOR_QUOTE_MAX_AGE_MS,
    ],
    ["a fresh aggregator quote", false, {}, 5_000],
    ["an old LI.FI quote", true, { source: SwapQuoteSource.LIFI }, 60_000],
    [
      "a classic quote of any age",
      false,
      { source: SwapQuoteSource.HORIZON },
      60_000,
    ],
    [
      "an aggregator quote that only asks for the trustline",
      false,
      { requiresTrustlineFirst: true },
      60_000,
    ],
  ])("%s: stale is %s", (_name, isStale, over, ageMs) => {
    jest.setSystemTime(1_000 + ageMs);

    expect(isStaleAggregatorQuote(freshnessPath(over))).toBe(isStale);
  });
  it.each(["feeStroops", "resourceFeeStroops"])(
    "refreshes a quote missing %s despite valid expiry",
    (field) => {
      jest.setSystemTime(1_000);
      const quote = freshnessPath();
      if (!quote.aggregatorTransaction) throw new Error("Transaction missing");
      quote.aggregatorTransaction = {
        ...quote.aggregatorTransaction,
        [field]: undefined,
      };
      expect(isStaleAggregatorQuote(quote)).toBe(true);
    },
  );

  it("keeps a fresh quote with zero resource fee", () => {
    jest.setSystemTime(1_000);
    expect(isStaleAggregatorQuote(freshnessPath())).toBe(false);
  });
});
