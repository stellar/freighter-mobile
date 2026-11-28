import { act, renderHook } from "@testing-library/react-hooks";
import { useTrendingTokenDetail } from "components/screens/SwapScreen/hooks/useTrendingTokenDetail";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { analytics } from "services/analytics";

const mockGetTokenDetails = jest.fn();
jest.mock("services/backend", () => ({
  getTokenDetails: (...args: unknown[]) => mockGetTokenDetails(...args),
}));
const mockShowToast = jest.fn();
jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
jest.mock("config/logger", () => ({
  logger: { error: jest.fn(), warn: jest.fn() },
}));
jest.mock("services/analytics", () => ({ analytics: { track: jest.fn() } }));
jest.mock("hooks/useAppTranslation", () => () => ({ t: (k: string) => k }));
let mockSwapState: { sourceTokenId: string; destinationToken: unknown } = {
  sourceTokenId: "XLM",
  destinationToken: null,
};
jest.mock("ducks/swap", () => ({
  useSwapStore: { getState: () => mockSwapState },
}));

const CONTRACT = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const ACCOUNT = "GBTYAFHGNZSTE4VBWZYAGB3SRGJEPTI5I4Y22KZ4JTVAN56LESB6JZOF";
const record = {
  tokenCode: "TKN",
  issuer: CONTRACT,
  domain: "",
  hasTrustline: false,
  isNative: false,
  tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
};

describe("useTrendingTokenDetail", () => {
  it("picks a trending Soroban token at the decimals /token-details reports", async () => {
    mockGetTokenDetails.mockResolvedValue({
      name: "Token",
      symbol: "TKN",
      decimals: 18,
    });
    const setDestinationToken = jest.fn();
    const { result } = renderHook(() =>
      useTrendingTokenDetail({
        entrySource: "home",
        balanceItems: [],
        sourceTokenId: "XLM",
        setSourceToken: jest.fn(),
        setDestinationToken,
        publicKey: ACCOUNT,
        network: NETWORKS.PUBLIC,
      }),
    );

    act(() => {
      result.current.openTrendingDetail(record, 0);
    });
    await act(async () => {
      result.current.confirmTrendingSelection();
      await new Promise((r) => {
        setImmediate(r);
      });
    });

    expect(mockGetTokenDetails).toHaveBeenCalledWith({
      contractId: CONTRACT,
      publicKey: ACCOUNT,
      network: NETWORKS.PUBLIC,
    });
    expect(setDestinationToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: `TKN:${CONTRACT}`, decimals: 18 }),
    );
  });

  it("drops a late decimals result if the destination changed since the press", async () => {
    let resolveDetails: (v: unknown) => void = () => {};
    mockGetTokenDetails.mockReturnValue(
      new Promise((r) => {
        resolveDetails = r;
      }),
    );
    mockSwapState = { sourceTokenId: "XLM", destinationToken: null };
    const setDestinationToken = jest.fn();
    const { result } = renderHook(() =>
      useTrendingTokenDetail({
        entrySource: "home",
        balanceItems: [],
        sourceTokenId: "XLM",
        setSourceToken: jest.fn(),
        setDestinationToken,
        publicKey: ACCOUNT,
        network: NETWORKS.PUBLIC,
      }),
    );

    act(() => {
      result.current.openTrendingDetail(record, 0);
    });
    act(() => {
      result.current.confirmTrendingSelection();
    });
    mockSwapState = {
      sourceTokenId: "XLM",
      destinationToken: { id: "AQUA:GBNZ" },
    };
    await act(async () => {
      resolveDetails({ name: "Token", symbol: "TKN", decimals: 18 });
      await new Promise((r) => {
        setImmediate(r);
      });
    });

    expect(setDestinationToken).not.toHaveBeenCalled();
  });

  it("drops a late decimals result once the detail sheet is dismissed", async () => {
    let resolveDetails: (v: unknown) => void = () => {};
    mockGetTokenDetails.mockReturnValue(
      new Promise((r) => {
        resolveDetails = r;
      }),
    );
    mockSwapState = { sourceTokenId: "XLM", destinationToken: null };
    const setDestinationToken = jest.fn();
    const { result } = renderHook(() =>
      useTrendingTokenDetail({
        entrySource: "home",
        balanceItems: [],
        sourceTokenId: "XLM",
        setSourceToken: jest.fn(),
        setDestinationToken,
        publicKey: ACCOUNT,
        network: NETWORKS.PUBLIC,
      }),
    );

    act(() => {
      result.current.openTrendingDetail(record, 0);
    });
    act(() => {
      result.current.confirmTrendingSelection();
    });
    // The sheet's onChange(-1): the user closed it while the read was out.
    act(() => {
      result.current.clearSelectedTrendingRecord();
    });
    await act(async () => {
      resolveDetails({ name: "Token", symbol: "TKN", decimals: 18 });
      await new Promise((r) => {
        setImmediate(r);
      });
    });

    expect(setDestinationToken).not.toHaveBeenCalled();
  });

  it("reads /token-details once while a confirm for the same token is pending", () => {
    mockGetTokenDetails.mockClear();
    mockGetTokenDetails.mockReturnValue(new Promise(() => {}));
    mockSwapState = { sourceTokenId: "XLM", destinationToken: null };
    const { result } = renderHook(() =>
      useTrendingTokenDetail({
        entrySource: "home",
        balanceItems: [],
        sourceTokenId: "XLM",
        setSourceToken: jest.fn(),
        setDestinationToken: jest.fn(),
        publicKey: ACCOUNT,
        network: NETWORKS.PUBLIC,
      }),
    );

    act(() => {
      result.current.openTrendingDetail(record, 0);
    });
    act(() => {
      result.current.confirmTrendingSelection();
      result.current.confirmTrendingSelection();
    });

    expect(mockGetTokenDetails).toHaveBeenCalledTimes(1);
  });

  it("picks the held balance for a trending token listed under another code", () => {
    mockGetTokenDetails.mockClear();
    mockSwapState = { sourceTokenId: "XLM", destinationToken: null };
    const held = {
      id: `SYM:${CONTRACT}`,
      tokenCode: "SYM",
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      contractId: CONTRACT,
      decimals: 7,
    } as never;
    const setDestinationToken = jest.fn();
    const { result } = renderHook(() =>
      useTrendingTokenDetail({
        entrySource: "home",
        balanceItems: [held],
        sourceTokenId: "XLM",
        setSourceToken: jest.fn(),
        setDestinationToken,
        publicKey: ACCOUNT,
        network: NETWORKS.PUBLIC,
      }),
    );

    act(() => {
      result.current.openTrendingDetail(record, 0);
    });
    act(() => {
      result.current.confirmTrendingSelection();
    });

    expect(mockGetTokenDetails).not.toHaveBeenCalled();
    expect(setDestinationToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: `SYM:${CONTRACT}` }),
    );
  });

  describe("the swap's entry source on the trending events", () => {
    const held = {
      id: `TKN:${CONTRACT}`,
      tokenCode: "TKN",
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      contractId: CONTRACT,
      decimals: 7,
    } as never;

    const renderFromTokenDetails = () =>
      renderHook(() =>
        useTrendingTokenDetail({
          entrySource: "token_details",
          // Held, so the pick applies at once, without /token-details.
          balanceItems: [held],
          sourceTokenId: "XLM",
          setSourceToken: jest.fn(),
          setDestinationToken: jest.fn(),
          publicKey: ACCOUNT,
          network: NETWORKS.PUBLIC,
        }),
      );

    beforeEach(() => {
      (analytics.track as jest.Mock).mockClear();
      mockSwapState = { sourceTokenId: "XLM", destinationToken: null };
    });

    it("tags swap.trending_token_tapped", () => {
      const { result } = renderFromTokenDetails();

      act(() => {
        result.current.openTrendingDetail(record, 2);
      });

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TRENDING_TOKEN_TAPPED,
        expect.objectContaining({ position: 2, source: "token_details" }),
      );
    });

    it("tags swap.trending_swap_to_pressed", () => {
      const { result } = renderFromTokenDetails();

      act(() => {
        result.current.openTrendingDetail(record, 0);
      });
      act(() => {
        result.current.confirmTrendingSelection();
      });

      expect(analytics.track).toHaveBeenCalledWith(
        AnalyticsEvent.SWAP_TRENDING_SWAP_TO_PRESSED,
        expect.objectContaining({ tokenCode: "TKN", source: "token_details" }),
      );
    });
  });
});
