import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import {
  ActiveSessions,
  StellarRpcChains,
  StellarRpcMethods,
  WalletKitSessionProposal,
} from "ducks/walletKit";
import {
  approveSessionProposal,
  createWalletKit,
  getActiveSessions,
  isDappRequestUndisplayable,
  partitionAccountSessions,
  resolveDappRejectionEvent,
} from "helpers/walletKitUtil";
import { TFunction } from "i18next";

// A stand-in WalletKit client, installed through createWalletKit.
const mockWalletKit = {
  getActiveSessions: jest.fn(),
  disconnectSession: jest.fn(() => Promise.resolve()),
  approveSession: jest.fn(),
  rejectSession: jest.fn(() => Promise.resolve()),
};
jest.mock("@walletconnect/core", () => ({ Core: jest.fn() }));
jest.mock("@reown/walletkit", () => ({
  WalletKit: { init: jest.fn(() => Promise.resolve(mockWalletKit)) },
}));

const PUBLIC_KEY = "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57";
const TESTNET_ACCOUNT = `${StellarRpcChains.TESTNET}:${PUBLIC_KEY}`;
const OTHER_ACCOUNT = `${StellarRpcChains.TESTNET}:GOTHER`;

/** A stored session whose stellar namespace lists `accounts`. */
const sessionWithAccounts = (accounts: unknown) => ({
  namespaces: { stellar: { accounts } },
});

describe("partitionAccountSessions", () => {
  it("keeps the account's sessions and flags the ones without Stellar accounts", () => {
    const all = {
      mine: sessionWithAccounts([TESTNET_ACCOUNT]),
      other: sessionWithAccounts([OTHER_ACCOUNT]),
      noStellar: { namespaces: {} },
      notAnArray: sessionWithAccounts("not-an-array"),
      noNamespaces: {},
      nonString: sessionWithAccounts([7, TESTNET_ACCOUNT]),
    } as unknown as ActiveSessions;

    const { accountSessions, malformedTopics } = partitionAccountSessions(
      all,
      TESTNET_ACCOUNT,
    );

    expect(Object.keys(accountSessions)).toEqual(["mine"]);
    expect(malformedTopics).toEqual([
      "noStellar",
      "notAnArray",
      "noNamespaces",
      "nonString",
    ]);
  });
});

describe("getActiveSessions", () => {
  beforeAll(async () => {
    await createWalletKit();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns the account's sessions and disconnects the malformed ones", () => {
    mockWalletKit.getActiveSessions.mockReturnValue({
      mine: sessionWithAccounts([TESTNET_ACCOUNT]),
      noStellar: { namespaces: {} },
    });

    const sessions = getActiveSessions(PUBLIC_KEY, NETWORKS.TESTNET);

    expect(Object.keys(sessions)).toEqual(["mine"]);
    expect(mockWalletKit.disconnectSession).toHaveBeenCalledTimes(1);
    expect(mockWalletKit.disconnectSession).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "noStellar" }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      "getActiveSessions",
      "Skipped sessions without Stellar accounts",
      { count: 1 },
    );
  });

  it("disconnects nothing when every session is well formed", () => {
    mockWalletKit.getActiveSessions.mockReturnValue({
      mine: sessionWithAccounts([TESTNET_ACCOUNT]),
      other: sessionWithAccounts([OTHER_ACCOUNT]),
    });

    expect(
      Object.keys(getActiveSessions(PUBLIC_KEY, NETWORKS.TESTNET)),
    ).toEqual(["mine"]);
    expect(mockWalletKit.disconnectSession).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("approveSessionProposal toasts", () => {
  const ACTIVE_CHAIN = "stellar:testnet";
  const DAPP_URL = "https://dapp.example";

  /** Renders a key with its dApp name, so the test can read what was shown. */
  const t = ((key: string, options?: { dappName?: unknown }) =>
    options && "dappName" in options
      ? `${key}(${String(options.dappName)})`
      : key) as unknown as TFunction<"translations", undefined>;

  const proposal = (metadata: unknown) =>
    ({
      id: 1,
      params: {
        id: 1,
        proposer: { publicKey: "proposer", metadata },
        requiredNamespaces: {},
        optionalNamespaces: {
          stellar: { chains: [ACTIVE_CHAIN], methods: [], events: [] },
        },
      },
    }) as unknown as WalletKitSessionProposal;

  const approve = (metadata: unknown, showToast: jest.Mock) =>
    approveSessionProposal({
      sessionProposal: proposal(metadata),
      activeChain: ACTIVE_CHAIN,
      activeAccount: `${ACTIVE_CHAIN}:${PUBLIC_KEY}`,
      showToast,
      t,
    });

  beforeAll(async () => {
    await createWalletKit();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("names the dApp by its normalized name when the connection succeeds", async () => {
    const metadata = { name: 7, url: DAPP_URL };
    mockWalletKit.approveSession.mockResolvedValue({ peer: { metadata } });
    const showToast = jest.fn();

    await approve(metadata, showToast);

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "walletKit.connectionSuccessfull(dapp.example)",
        variant: "success",
      }),
    );
  });

  it("names the dApp by its normalized name when the connection fails", async () => {
    mockWalletKit.approveSession.mockRejectedValue(new Error("relay down"));
    const showToast = jest.fn();

    await approve({ name: "n".repeat(500), url: DAPP_URL }, showToast);

    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: `walletKit.errorConnecting(${"n".repeat(100)})`,
        variant: "error",
      }),
    );
  });
});

describe("resolveDappRejectionEvent (dApp-request teardown → signing.*_rejected)", () => {
  const base = {
    requestMethod: StellarRpcMethods.SIGN_XDR,
    hasRequestEvent: true,
    hasResponded: false,
    approvalInFlight: false,
  };

  it("maps each signing method to its rejection event on a genuine dismissal", () => {
    expect(
      resolveDappRejectionEvent({
        ...base,
        requestMethod: StellarRpcMethods.SIGN_MESSAGE,
      }),
    ).toBe("message");
    expect(
      resolveDappRejectionEvent({
        ...base,
        requestMethod: StellarRpcMethods.SIGN_AUTH_ENTRY,
      }),
    ).toBe("auth_entry");
    expect(
      resolveDappRejectionEvent({
        ...base,
        requestMethod: StellarRpcMethods.SIGN_XDR,
      }),
    ).toBe("transaction");
    expect(
      resolveDappRejectionEvent({
        ...base,
        requestMethod: StellarRpcMethods.SIGN_AND_SUBMIT_XDR,
      }),
    ).toBe("transaction");
  });

  // The reviewer's exact concern: an approved/completed request must NOT emit a
  // rejection, even though handleClearDappRequest still runs in the .finally().
  it("returns null once the request has been responded to (approved/completed)", () => {
    expect(
      resolveDappRejectionEvent({ ...base, hasResponded: true }),
    ).toBeNull();
  });

  // approveSessionRequest threw: the WC fallback rejection still fires, but this
  // is an approval attempt, not a user reject — so no analytics rejection.
  it("returns null when an approval attempt was in flight (even if it threw)", () => {
    expect(
      resolveDappRejectionEvent({ ...base, approvalInFlight: true }),
    ).toBeNull();
  });

  it("returns null when there is no active request", () => {
    expect(
      resolveDappRejectionEvent({ ...base, hasRequestEvent: false }),
    ).toBeNull();
  });

  it("returns null for an unrecognized / undefined method", () => {
    expect(
      resolveDappRejectionEvent({ ...base, requestMethod: undefined }),
    ).toBeNull();
  });
});

describe("isDappRequestUndisplayable (a request the app can't display can only be rejected)", () => {
  const base = {
    signTransactionDetailsStatus: "ready" as const,
    isAuthEntryDisplayable: true,
    hasDetailsRenderError: false,
  };

  it.each([StellarRpcMethods.SIGN_XDR, StellarRpcMethods.SIGN_AND_SUBMIT_XDR])(
    "%s fails closed unless its details are ready",
    (requestMethod) => {
      expect(isDappRequestUndisplayable({ ...base, requestMethod })).toBe(
        false,
      );
      expect(
        isDappRequestUndisplayable({
          ...base,
          requestMethod,
          signTransactionDetailsStatus: "undisplayable",
        }),
      ).toBe(true);
      expect(
        isDappRequestUndisplayable({
          ...base,
          requestMethod,
          signTransactionDetailsStatus: "empty",
        }),
      ).toBe(true);
    },
  );

  it("fails an auth entry closed only when its invocation can't be displayed", () => {
    const authEntry = {
      ...base,
      requestMethod: StellarRpcMethods.SIGN_AUTH_ENTRY,
      signTransactionDetailsStatus: "empty" as const,
    };

    expect(isDappRequestUndisplayable(authEntry)).toBe(false);
    expect(
      isDappRequestUndisplayable({
        ...authEntry,
        isAuthEntryDisplayable: false,
      }),
    ).toBe(true);
  });

  it("never fails a sign_message request closed for display reasons", () => {
    expect(
      isDappRequestUndisplayable({
        ...base,
        requestMethod: StellarRpcMethods.SIGN_MESSAGE,
        signTransactionDetailsStatus: "empty",
        isAuthEntryDisplayable: false,
      }),
    ).toBe(false);
  });

  it("fails a request closed once its details tripped the error boundary", () => {
    [StellarRpcMethods.SIGN_XDR, StellarRpcMethods.SIGN_AUTH_ENTRY].forEach(
      (requestMethod) =>
        expect(
          isDappRequestUndisplayable({
            ...base,
            requestMethod,
            hasDetailsRenderError: true,
          }),
        ).toBe(true),
    );
  });

  it("returns false when there is no request", () => {
    expect(
      isDappRequestUndisplayable({
        ...base,
        requestMethod: undefined,
        signTransactionDetailsStatus: "empty",
      }),
    ).toBe(false);
  });
});
