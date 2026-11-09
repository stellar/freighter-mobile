import { act, renderHook } from "@testing-library/react-hooks";
import { useTrendingTokenDetail } from "components/screens/SwapScreen/hooks/useTrendingTokenDetail";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";

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
});
