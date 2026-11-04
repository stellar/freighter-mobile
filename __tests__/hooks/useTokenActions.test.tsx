import { Asset, Networks } from "@stellar/stellar-sdk";
import { renderHook } from "@testing-library/react-hooks";
import { NETWORKS } from "config/constants";
import { useTokenActions } from "hooks/useTokenActions";

const mockCopyToClipboard = jest.fn();
jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => key,
}));

let mockNetwork = NETWORKS.PUBLIC;
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: mockNetwork }),
}));

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const CONTRACT_ID = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";
const MESSAGE_KEY = "manageTokenRightContent.tokenAddressCopied";

describe("useTokenActions.copyTokenAddress", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork = NETWORKS.PUBLIC;
  });

  it.each([
    [NETWORKS.PUBLIC, Networks.PUBLIC],
    [NETWORKS.TESTNET, Networks.TESTNET],
  ])(
    "copies the native contract id for XLM on %s, not the XLM code",
    (network, passphrase) => {
      mockNetwork = network;
      const { result } = renderHook(() => useTokenActions());

      result.current.copyTokenAddress("XLM", MESSAGE_KEY);

      const expected = Asset.native().contractId(passphrase);
      expect(mockCopyToClipboard).toHaveBeenCalledWith(expected, {
        notificationMessage: MESSAGE_KEY,
      });
      expect(expected).not.toBe("XLM");
    },
  );

  it("copies the native contract id for the Horizon 'native' id", () => {
    const { result } = renderHook(() => useTokenActions());

    result.current.copyTokenAddress("native", MESSAGE_KEY);

    expect(mockCopyToClipboard).toHaveBeenCalledWith(
      Asset.native().contractId(Networks.PUBLIC),
      { notificationMessage: MESSAGE_KEY },
    );
  });

  it("copies the issuer for a classic CODE:ISSUER id", () => {
    const { result } = renderHook(() => useTokenActions());

    result.current.copyTokenAddress(`USDC:${ISSUER}`, MESSAGE_KEY);

    expect(mockCopyToClipboard).toHaveBeenCalledWith(ISSUER, {
      notificationMessage: MESSAGE_KEY,
    });
  });

  it("copies a bare contract id as is", () => {
    const { result } = renderHook(() => useTokenActions());

    result.current.copyTokenAddress(CONTRACT_ID, MESSAGE_KEY);

    expect(mockCopyToClipboard).toHaveBeenCalledWith(CONTRACT_ID, {
      notificationMessage: MESSAGE_KEY,
    });
  });

  it("copies nothing for an empty id", () => {
    const { result } = renderHook(() => useTokenActions());

    result.current.copyTokenAddress("", MESSAGE_KEY);

    expect(mockCopyToClipboard).not.toHaveBeenCalled();
  });
});
