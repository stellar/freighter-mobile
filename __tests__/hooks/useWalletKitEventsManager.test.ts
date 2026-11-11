import { act, renderHook } from "@testing-library/react-native";
import { logger } from "config/logger";
import { walletKit } from "helpers/walletKitUtil";
import { useWalletKitEventsManager } from "hooks/useWalletKitEventsManager";
import { EmitterSubscription, Linking } from "react-native";

const REDIRECT = "freighterwallet://wc-redirect";
const INVALID_LINK = `${REDIRECT}?uri=%FF`;
const INVALID_LINK_TOAST = {
  title: "walletKit.errorPairing",
  message: "walletKit.errorInvalidPairingLink",
  variant: "error",
};

const mockShowToast = jest.fn();
// Stable references, so the hook's callbacks and effects don't churn.
const mockStore = { setEvent: jest.fn(), fetchActiveSessions: jest.fn() };
const mockT = (key: string) => key;

jest.mock("helpers/walletKitUtil", () => ({
  walletKit: {
    on: jest.fn(),
    off: jest.fn(),
    pair: jest.fn(() => Promise.resolve()),
  },
}));
jest.mock("ducks/walletKit", () => ({
  WALLET_KIT_MT_REDIRECT_NATIVE: "freighterwallet://wc-redirect",
  WalletKitEventTypes: {
    SESSION_PROPOSAL: "SESSION_PROPOSAL",
    SESSION_REQUEST: "SESSION_REQUEST",
    NONE: "NONE",
  },
  useWalletKitStore: () => mockStore,
}));
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "TESTNET" }),
}));
jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: { publicKey: "GABC" } }),
}));
jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: mockT }),
}));

/** The `url` listener the hook registered with Linking. */
let urlListener: ((event: { url: string }) => void) | undefined;

/** Renders the hook and lets the launch-link read settle. */
const renderManager = async () => {
  renderHook(() => useWalletKitEventsManager(true));
  await act(async () => {});
};

describe("useWalletKitEventsManager: pairing links", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    urlListener = undefined;
    jest
      .spyOn(Linking, "addEventListener")
      .mockImplementation((_type, listener) => {
        urlListener = listener as (event: { url: string }) => void;
        return { remove: jest.fn() } as unknown as EmitterSubscription;
      });
    jest.spyOn(Linking, "getInitialURL").mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const openLink = (url: string) => {
    if (!urlListener) {
      throw new Error("The hook never registered a url listener");
    }
    urlListener({ url });
  };

  it("shows the pairing error, without pairing, for a link whose URI doesn't decode", async () => {
    await renderManager();

    expect(() => openLink(INVALID_LINK)).not.toThrow();
    expect(mockShowToast).toHaveBeenCalledWith(INVALID_LINK_TOAST);
    expect(walletKit.pair).not.toHaveBeenCalled();
  });

  it("shows the pairing error for a launch link whose URI doesn't decode", async () => {
    jest.spyOn(Linking, "getInitialURL").mockResolvedValue(INVALID_LINK);

    await renderManager();

    expect(mockShowToast).toHaveBeenCalledWith(INVALID_LINK_TOAST);
    expect(walletKit.pair).not.toHaveBeenCalled();
  });

  it("logs, without throwing, when the launch link can't be read", async () => {
    const failure = new Error("no launch link");
    jest.spyOn(Linking, "getInitialURL").mockRejectedValue(failure);

    await renderManager();

    expect(logger.warn).toHaveBeenCalledWith(
      "onDeepLink",
      "Failed to read the initial link",
      failure,
    );
  });

  it("pairs with the decoded URI of a well-formed link", async () => {
    await renderManager();

    openLink(`${REDIRECT}?uri=wc%3Aabc%402%3FsymKey%3D00`);

    expect(walletKit.pair).toHaveBeenCalledWith({
      uri: "wc:abc@2?symKey=00",
    });
    expect(mockShowToast).not.toHaveBeenCalled();
  });

  it("stays silent for a bare redirect link", async () => {
    await renderManager();

    openLink(REDIRECT);

    expect(walletKit.pair).not.toHaveBeenCalled();
    expect(mockShowToast).not.toHaveBeenCalled();
  });
});
