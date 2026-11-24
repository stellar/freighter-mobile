import { act, renderHook } from "@testing-library/react-hooks";
import { useSelectSwapDestination } from "components/screens/SwapScreen/hooks/useSelectSwapDestination";
import { AnalyticsEvent, SwapSelectionSource } from "config/analyticsConfig";
import { NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { useSwapStore } from "ducks/swap";
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
const ACCOUNT = "GBTYAFHGNZSTE4VBWZYAGB3SRGJEPTI5I4Y22KZ4JTVAN56LESB6JZOF";
jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: {
      publicKey: "GBTYAFHGNZSTE4VBWZYAGB3SRGJEPTI5I4Y22KZ4JTVAN56LESB6JZOF",
    },
  }),
}));
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "PUBLIC" }),
}));

interface MockSwapState {
  sourceTokenId: string;
  destinationToken: { id: string } | null;
  setSourceToken: (id: string, symbol: string) => void;
  setDestinationToken: (descriptor: { id: string } | null) => void;
}
let mockSwapState: MockSwapState;
const resetSwapState = (destinationToken: { id: string } | null = null) => {
  mockSwapState = {
    sourceTokenId: "XLM",
    destinationToken,
    setSourceToken: (id) => {
      mockSwapState = { ...mockSwapState, sourceTokenId: id };
    },
    setDestinationToken: (descriptor) => {
      mockSwapState = { ...mockSwapState, destinationToken: descriptor };
    },
  };
};
jest.mock("ducks/swap", () => ({
  useSwapStore: { getState: () => mockSwapState },
}));

const CONTRACT = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const record = {
  tokenCode: "TKN",
  issuer: CONTRACT,
  domain: "",
  hasTrustline: false,
  isNative: false,
  tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
};

const flush = () =>
  new Promise((r) => {
    setImmediate(r);
  });

const deferDecimals = () => {
  let resolveDetails: (v: unknown) => void = () => {};
  mockGetTokenDetails.mockReturnValue(
    new Promise((r) => {
      resolveDetails = r;
    }),
  );
  return async () => {
    resolveDetails({ name: "Token", symbol: "TKN", decimals: 18 });
    await flush();
  };
};

describe("useSelectSwapDestination", () => {
  const onSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    onSelected.mockReset();
    resetSwapState();
  });

  afterEach(() => {
    const { useBalancesList } = jest.requireMock("hooks/useBalancesList");
    useBalancesList.mockReset();
    useBalancesList.mockReturnValue({
      balanceItems: [],
      hiddenBalanceItems: [],
      scanResults: {},
      isLoading: false,
      error: null,
      noBalances: true,
      isRefreshing: false,
      isFunded: false,
      handleRefresh: jest.fn(),
    });
  });

  it("picks a Soroban token at the decimals /token-details reports", async () => {
    mockGetTokenDetails.mockResolvedValue({
      name: "Token",
      symbol: "TKN",
      decimals: 18,
    });
    const { result } = renderHook(() =>
      useSelectSwapDestination({ record, onSelected }),
    );

    await act(async () => {
      result.current.select();
      await flush();
    });

    expect(mockGetTokenDetails).toHaveBeenCalledWith({
      contractId: CONTRACT,
      publicKey: ACCOUNT,
      network: NETWORKS.PUBLIC,
    });
    expect(useSwapStore.getState().destinationToken).toEqual(
      expect.objectContaining({ id: `TKN:${CONTRACT}`, decimals: 18 }),
    );
    expect(analytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.SWAP_TRENDING_SWAP_TO_PRESSED,
      expect.objectContaining({ tokenCode: "TKN" }),
    );
    expect(analytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.SWAP_DESTINATION_SELECTED,
      expect.objectContaining({ source: SwapSelectionSource.TRENDING }),
    );
  });

  it("drops a late decimals result if the destination changed since the press", async () => {
    const resolveDecimals = deferDecimals();
    const { result } = renderHook(() =>
      useSelectSwapDestination({ record, onSelected }),
    );

    act(() => result.current.select());
    mockSwapState = { ...mockSwapState, destinationToken: { id: "AQUA:GBNZ" } };
    await act(() => resolveDecimals());

    expect(useSwapStore.getState().destinationToken).toEqual({
      id: "AQUA:GBNZ",
    });
    expect(onSelected).not.toHaveBeenCalled();
  });

  it("drops a late decimals result after unmount", async () => {
    const resolveDecimals = deferDecimals();
    const { result, unmount } = renderHook(() =>
      useSelectSwapDestination({ record, onSelected }),
    );

    act(() => result.current.select());
    unmount();
    await act(() => resolveDecimals());

    expect(useSwapStore.getState().destinationToken).toBeNull();
    expect(onSelected).not.toHaveBeenCalled();
  });

  it("calls onSelected after the destination is set", async () => {
    const resolveDecimals = deferDecimals();
    onSelected.mockImplementation(() => {
      expect(useSwapStore.getState().destinationToken?.id).toBe(
        `TKN:${CONTRACT}`,
      );
    });
    const { result } = renderHook(() =>
      useSelectSwapDestination({ record, onSelected }),
    );

    act(() => result.current.select());
    expect(result.current.isPending).toBe(true);
    await act(() => resolveDecimals());

    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(result.current.isPending).toBe(false);
  });

  it("reads /token-details once while a select for the same token is pending", () => {
    mockGetTokenDetails.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() =>
      useSelectSwapDestination({ record, onSelected }),
    );

    act(() => {
      result.current.select();
      result.current.select();
    });

    expect(mockGetTokenDetails).toHaveBeenCalledTimes(1);
  });

  it("picks the held balance for a token listed under another code", () => {
    const held = {
      id: `SYM:${CONTRACT}`,
      tokenCode: "SYM",
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      contractId: CONTRACT,
      decimals: 7,
    };
    const { useBalancesList } = jest.requireMock("hooks/useBalancesList");
    useBalancesList.mockReturnValue({ balanceItems: [held] });
    const { result } = renderHook(() =>
      useSelectSwapDestination({ record, onSelected }),
    );

    act(() => result.current.select());

    expect(mockGetTokenDetails).not.toHaveBeenCalled();
    expect(useSwapStore.getState().destinationToken).toEqual(
      expect.objectContaining({ id: `SYM:${CONTRACT}` }),
    );
    expect(onSelected).toHaveBeenCalledTimes(1);
  });

  it("picks a held balance by id when there is no record, tagged with the given source", () => {
    const { useBalancesList } = jest.requireMock("hooks/useBalancesList");
    useBalancesList.mockReturnValue({
      balanceItems: [
        {
          id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
          tokenCode: "USDC",
          tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
        },
      ],
    });
    const { result } = renderHook(() =>
      useSelectSwapDestination({
        record: undefined,
        heldTokenId:
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        selectionSource: SwapSelectionSource.BALANCES,
        onSelected,
      }),
    );

    act(() => result.current.select());

    expect(mockGetTokenDetails).not.toHaveBeenCalled();
    expect(useSwapStore.getState().destinationToken).toEqual(
      expect.objectContaining({
        id: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        requiresTrustline: false,
      }),
    );
    expect(analytics.track).not.toHaveBeenCalledWith(
      AnalyticsEvent.SWAP_TRENDING_SWAP_TO_PRESSED,
      expect.anything(),
    );
    expect(analytics.track).toHaveBeenCalledWith(
      AnalyticsEvent.SWAP_DESTINATION_SELECTED,
      expect.objectContaining({
        asset_code: "USDC",
        source: SwapSelectionSource.BALANCES,
      }),
    );
    expect(onSelected).toHaveBeenCalledTimes(1);
  });

  it("reports a held token it cannot find instead of doing nothing", () => {
    const { result } = renderHook(() =>
      useSelectSwapDestination({
        record: undefined,
        heldTokenId:
          "GONE:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        selectionSource: SwapSelectionSource.BALANCES,
        onSelected,
      }),
    );

    act(() => result.current.select());

    expect(onSelected).not.toHaveBeenCalled();
    expect(mockShowToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "error",
        title: "swapScreen.errors.tokenDetailsUnavailable",
      }),
    );
  });

  it("does nothing without a record", () => {
    const { result } = renderHook(() =>
      useSelectSwapDestination({ record: undefined, onSelected }),
    );

    act(() => result.current.select());

    expect(mockGetTokenDetails).not.toHaveBeenCalled();
    expect(onSelected).not.toHaveBeenCalled();
  });
});
