import { act, render } from "@testing-library/react-native";
import {
  authEntryPreimageXdr,
  invokeTransactionXdr,
  wideInvocationTree,
} from "__tests__/support/invocationTreeFixtures";
import {
  sacTransferPreimageXdr,
  sacTransferTransactionXdr,
} from "__tests__/support/sacTransferFixtures";
import type { SecurityDetailBottomSheetProps } from "components/blockaid";
import type DappRequestBottomSheetContent from "components/screens/WalletKit/DappRequestBottomSheetContent";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { AUTH_STATUS } from "config/types";
import type * as WalletKitDuck from "ducks/walletKit";
import * as signingDisplay from "helpers/signingDisplay";
import * as walletKitUtil from "helpers/walletKitUtil";
import * as dappMetadataHook from "hooks/useDappMetadata";
import { WalletKitProvider } from "providers/WalletKitProvider";
import React from "react";
import { analytics } from "services/analytics";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";
import { dataStorage } from "services/storage/storageFactory";

type RequestSheetProps = React.ComponentProps<
  typeof DappRequestBottomSheetContent
>;

/** The props the request sheet last rendered with. */
let mockRequestSheetProps: RequestSheetProps | undefined;
/** The props the Blockaid sheet last rendered with. */
let mockSecuritySheetProps: SecurityDetailBottomSheetProps | undefined;
/** The Blockaid verdict the debug store forces, or null for none. */
let mockBlockaidOverride: SecurityLevel | null = null;
/** The sheets presented, in order (see the BottomSheet mock). */
let mockPresentedSheets: string[] = [];
/** The sheets dismissed, in order (see the BottomSheet mock). */
let mockDismissedSheets: string[] = [];
/** Each sheet's onChange, by name (see the BottomSheet mock). */
const mockSheetOnChange: Record<string, (index: number) => void> = {};
/** Makes the request sheet's content throw while it shows a request. */
let mockFailRequestSheet = false;
/** Makes the connection sheet's content throw while it shows a proposal. */
let mockFailConnectionSheet = false;

const mockAuthState = {
  network: NETWORKS.TESTNET,
  authStatus: AUTH_STATUS.AUTHENTICATED,
};
const mockActiveAccount = {
  account: {
    publicKey: "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57",
    privateKey: "",
    accountName: "Account 1",
    id: "account-1",
    subentryCount: 0,
  },
  signTransaction: jest.fn(),
  signMessage: jest.fn(),
  signAuthEntry: jest.fn(),
};
const mockTransactionSettings = { transactionMemo: "", saveMemo: jest.fn() };
const mockToast = { showToast: jest.fn() };

// jest.setup.js stubs this duck for every suite. This one uses its real enums
// and drives its real store, the way WalletKit's event manager does.
jest.unmock("ducks/walletKit");

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => mockAuthState,
}));
jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => mockActiveAccount,
}));
jest.mock("ducks/debug", () => ({
  useDebugStore: () => ({ overriddenBlockaidResponse: mockBlockaidOverride }),
}));
jest.mock("ducks/transactionSettings", () => ({
  useTransactionSettingsStore: () => mockTransactionSettings,
}));
jest.mock("providers/ToastProvider", () => ({
  useToast: () => mockToast,
}));
// Returns the key, with the dApp name when one is passed.
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string, params?: { dappName?: string }) =>
      params?.dappName ? `${key} (${params.dappName})` : key,
  }),
}));
jest.mock("hooks/useWalletKitInitialize", () => ({
  useWalletKitInitialize: () => true,
}));
jest.mock("hooks/useWalletKitEventsManager", () => ({
  useWalletKitEventsManager: () => undefined,
}));
jest.mock("hooks/useValidateTransactionMemo", () => ({
  useValidateTransactionMemo: () => ({
    isMemoMissing: false,
    isValidatingMemo: false,
  }),
}));
// Every scan resolves; the verdict comes from the debug override.
jest.mock("hooks/blockaid/useBlockaidSite", () => ({
  useBlockaidSite: () => ({ scanSite: () => Promise.resolve(undefined) }),
}));
jest.mock("hooks/blockaid/useBlockaidTransaction", () => ({
  useBlockaidTransaction: () => ({
    scanTransaction: () => Promise.resolve(undefined),
  }),
}));
jest.mock("services/analytics", () => ({
  analytics: {
    trackSignedTransactionRejected: jest.fn(),
    trackSignedMessageRejected: jest.fn(),
  },
}));

// Every sheet renders its content as if presented. The request sheet and the
// Blockaid sheet record their props, which is what the test drives. Each
// present() and dismiss() is recorded in mockPresentedSheets and
// mockDismissedSheets, by the sheet's analytics event or else its content's
// component name, and each sheet's onChange is kept in mockSheetOnChange so a
// test can report the sheet as opened.
jest.mock("components/BottomSheet", () => ({
  __esModule: true,
  default: ({
    customContent,
    modalRef,
    analyticsEvent,
    bottomSheetModalProps,
  }: {
    customContent: React.ReactElement;
    modalRef?: { current: unknown };
    analyticsEvent?: string;
    bottomSheetModalProps?: { onChange?: (index: number) => void };
  }) => {
    const name =
      analyticsEvent ??
      (customContent.type as { name?: string }).name ??
      "sheet";
    if (bottomSheetModalProps?.onChange) {
      mockSheetOnChange[name] = bottomSheetModalProps.onChange;
    }
    if (modalRef) {
      // eslint-disable-next-line no-param-reassign
      modalRef.current = {
        present: () => mockPresentedSheets.push(name),
        dismiss: () => mockDismissedSheets.push(name),
      };
    }
    return customContent;
  },
}));
jest.mock("components/screens/WalletKit/DappRequestBottomSheetContent", () => ({
  __esModule: true,
  default: (props: RequestSheetProps) => {
    mockRequestSheetProps = props;
    if (mockFailRequestSheet && props.requestEvent) {
      throw new Error("request sheet render failed");
    }
    return null;
  },
}));
jest.mock("components/blockaid", () => ({
  SecurityDetailBottomSheet: (props: SecurityDetailBottomSheetProps) => {
    mockSecuritySheetProps = props;
    return null;
  },
}));
jest.mock(
  "components/screens/WalletKit/DappConnectionBottomSheetContent",
  () => ({
    __esModule: true,
    default: ({ proposalEvent }: { proposalEvent: unknown }) => {
      if (mockFailConnectionSheet && proposalEvent) {
        throw new Error("connection sheet render failed");
      }
      return null;
    },
  }),
);
jest.mock("components/AddMemoExplanationBottomSheet", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("components/InformationBottomSheet", () => ({
  __esModule: true,
  default: () => null,
}));

// helpers/walletKitUtil and ducks/walletKit import each other, and the util
// reads the duck's enums while it loads, so the util must load first. The
// imports above see to that (the provider would load the duck first), so they
// take only types from the duck; its values are reached from here on.
const {
  StellarRpcChains,
  StellarRpcMethods,
  WalletKitEventTypes,
  useWalletKitStore,
} = jest.requireActual<typeof WalletKitDuck>("ducks/walletKit");

const DAPP_URL = "https://dapp.example";

const ACTIVE_SESSIONS = {
  topic: {
    topic: "topic",
    peer: {
      metadata: { url: DAPP_URL, name: "dApp", description: "", icons: [] },
    },
  },
} as unknown as WalletKitDuck.ActiveSessions;

/** A request for `method`, with `params`, from the connected dApp. */
const dappRequest = (
  id: number,
  method: WalletKitDuck.StellarRpcMethods,
  params: Record<string, string>,
) =>
  ({
    type: WalletKitEventTypes.SESSION_REQUEST,
    id,
    topic: "topic",
    params: {
      chainId: StellarRpcChains.TESTNET,
      request: { method, params },
    },
    verifyContext: { verified: { origin: DAPP_URL } },
  }) as unknown as WalletKitDuck.WalletKitSessionRequest;

/** A stellar_signXDR request for `xdr` from the connected dApp. */
const signXdrRequest = (id: number, xdr: string) =>
  dappRequest(id, StellarRpcMethods.SIGN_XDR, { xdr });

/** A stellar_signAuthEntry request for the preimage `entryXdr` from the connected dApp. */
const signAuthEntryRequest = (id: number, entryXdr: string) =>
  dappRequest(id, StellarRpcMethods.SIGN_AUTH_ENTRY, { entryXdr });

const BLOCKED_APPROVAL = [
  "WalletKitProvider",
  "Blocked approval of a request whose details can't be displayed",
  expect.objectContaining({
    message: "Undisplayable dApp request approval blocked",
  }),
];

/** A new element each time, so a rerender reaches the provider. */
const provider = () => <WalletKitProvider>{null}</WalletKitProvider>;

const requestSheet = (): RequestSheetProps => {
  if (!mockRequestSheetProps) {
    throw new Error("The request sheet never rendered");
  }
  return mockRequestSheetProps;
};

const securitySheet = (): SecurityDetailBottomSheetProps => {
  if (!mockSecuritySheetProps) {
    throw new Error("The Blockaid sheet never rendered");
  }
  return mockSecuritySheetProps;
};

/** Runs `action` in act, then lets the promises it started settle in act too. */
const actAndSettle = async (action: () => void) => {
  act(action);
  await act(async () => {});
};

/** Delivers a request as WalletKit's event manager does; its scan settles. */
const deliver = (request: WalletKitDuck.WalletKitSessionRequest) =>
  actAndSettle(() => useWalletKitStore.getState().setEvent(request));

describe("WalletKitProvider: a dApp request whose details can't be displayed", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // Stand-ins for the WalletConnect calls; everything else in the util is real.
    jest
      .spyOn(walletKitUtil, "approveSessionRequest")
      .mockResolvedValue(undefined);
    jest
      .spyOn(walletKitUtil, "rejectSessionRequest")
      .mockResolvedValue(undefined);
    mockRequestSheetProps = undefined;
    mockSecuritySheetProps = undefined;
    mockBlockaidOverride = null;
    useWalletKitStore.getState().clearEvent();
    useWalletKitStore.setState({ activeSessions: ACTIVE_SESSIONS });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("refuses Confirm on an XDR request that doesn't parse", async () => {
    render(provider());
    await deliver(signXdrRequest(1, "not-xdr"));

    expect(requestSheet().requestEvent?.id).toBe(1);
    expect(requestSheet().isUndisplayable).toBe(true);

    act(() => requestSheet().onConfirm());

    expect(walletKitUtil.approveSessionRequest).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(...BLOCKED_APPROVAL);
  });

  it("approves a displayable XDR request", async () => {
    render(provider());
    await deliver(signXdrRequest(1, sacTransferTransactionXdr()));

    expect(requestSheet().isUndisplayable).toBe(false);

    await actAndSettle(() => requestSheet().onConfirm());

    expect(walletKitUtil.approveSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKitUtil.approveSessionRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionRequest: expect.objectContaining({ id: 1 }),
      }),
    );
    expect(logger.error).not.toHaveBeenCalledWith(...BLOCKED_APPROVAL);
  });

  it("refuses the Blockaid sheet's Confirm anyway on a flagged request it can't display", async () => {
    mockBlockaidOverride = SecurityLevel.MALICIOUS;
    render(provider());
    await deliver(signXdrRequest(1, "not-xdr"));

    expect(requestSheet().isMalicious).toBe(true);
    expect(requestSheet().isUndisplayable).toBe(true);

    // The banner's action opens the Blockaid sheet over the request.
    act(() => requestSheet().securityWarningAction?.());
    expect(securitySheet().securityContext).toBe(SecurityContext.TRANSACTION);

    act(() => securitySheet().onProceedAnyway?.());

    expect(walletKitUtil.approveSessionRequest).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(...BLOCKED_APPROVAL);
  });

  it("keeps a request closed after a details render error until it's torn down, then approves the next", async () => {
    const { rerender } = render(provider());
    await deliver(signXdrRequest(1, sacTransferTransactionXdr()));
    expect(requestSheet().isUndisplayable).toBe(false);

    // The details sheet's boundary trips: the request fails closed.
    act(() => requestSheet().onDetailsRenderError?.());
    expect(requestSheet().isUndisplayable).toBe(true);
    act(() => requestSheet().onConfirm());
    expect(walletKitUtil.approveSessionRequest).not.toHaveBeenCalled();

    // Cancel rejects it. Until the deferred reset runs, the same request is
    // still showing, and it stays closed.
    act(() => requestSheet().onCancelRequest());
    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledTimes(1);
    rerender(provider());
    expect(requestSheet().requestEvent?.id).toBe(1);
    expect(requestSheet().isUndisplayable).toBe(true);

    // The deferred reset clears the request and the flag together. The flag
    // fails a request closed even with no request, so false means it's clear.
    // Running the pending timers runs the reset, whatever its delay.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(requestSheet().requestEvent).toBeNull();
    expect(requestSheet().isUndisplayable).toBe(false);

    // The next request starts clean and is approved.
    await deliver(signXdrRequest(2, sacTransferTransactionXdr()));
    expect(requestSheet().requestEvent?.id).toBe(2);
    expect(requestSheet().isUndisplayable).toBe(false);

    await actAndSettle(() => requestSheet().onConfirm());

    expect(walletKitUtil.approveSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKitUtil.approveSessionRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionRequest: expect.objectContaining({ id: 2 }),
      }),
    );
  });

  it("refuses Confirm on an auth-entry request whose preimage can't be displayed", async () => {
    // A well-formed preimage for this network, so prevalidation lets it
    // through. signingDisplay.test.ts pins what the pre-flight rejects; this
    // pins what the provider does with its verdict.
    jest.spyOn(signingDisplay, "isAuthEntryDisplayable").mockReturnValue(false);
    const entryXdr = sacTransferPreimageXdr();
    render(provider());
    await deliver(signAuthEntryRequest(1, entryXdr));

    // Prevalidation passed: nothing rejected the request, which is on screen.
    expect(walletKitUtil.rejectSessionRequest).not.toHaveBeenCalled();
    expect(requestSheet().requestEvent?.id).toBe(1);
    expect(signingDisplay.isAuthEntryDisplayable).toHaveBeenCalledWith(
      entryXdr,
    );
    expect(requestSheet().isUndisplayable).toBe(true);

    act(() => requestSheet().onConfirm());

    expect(walletKitUtil.approveSessionRequest).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(...BLOCKED_APPROVAL);
  });

  it("approves a displayable auth-entry request", async () => {
    render(provider());
    await deliver(signAuthEntryRequest(1, sacTransferPreimageXdr()));

    expect(walletKitUtil.rejectSessionRequest).not.toHaveBeenCalled();
    expect(requestSheet().requestEvent?.id).toBe(1);
    expect(requestSheet().isUndisplayable).toBe(false);

    await actAndSettle(() => requestSheet().onConfirm());

    expect(walletKitUtil.approveSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKitUtil.approveSessionRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionRequest: expect.objectContaining({ id: 1 }),
      }),
    );
    expect(logger.error).not.toHaveBeenCalledWith(...BLOCKED_APPROVAL);
  });
});

describe("WalletKitProvider: a request whose params fail validation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest
      .spyOn(walletKitUtil, "rejectSessionRequest")
      .mockResolvedValue(undefined);
    mockRequestSheetProps = undefined;
    mockBlockaidOverride = null;
    useWalletKitStore.getState().clearEvent();
    useWalletKitStore.setState({ activeSessions: ACTIVE_SESSIONS });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([42, ""])(
    "rejects a stellar_signXDR request whose xdr is %p and moves on to the next request",
    async (badXdr) => {
      render(provider());
      await deliver(signXdrRequest(1, badXdr as unknown as string));

      expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledWith({
        sessionRequest: expect.objectContaining({ id: 1 }),
        message: "walletKit.errorInvalidXdr",
      });
      expect(mockToast.showToast).toHaveBeenCalledWith({
        title: "walletKit.invalidRequestTitle",
        message: "walletKit.errorInvalidXdr",
        variant: "error",
      });

      // Rejected up front, so nothing is left processing: the next request
      // shows at once instead of waiting in the queue.
      await deliver(signXdrRequest(2, sacTransferTransactionXdr()));

      expect(requestSheet().requestEvent?.id).toBe(2);
    },
  );

  it("rejects a stellar_signXDR request whose xdr is over 262144 characters and moves on", async () => {
    render(provider());
    await deliver(signXdrRequest(1, "A".repeat(262145)));

    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledWith({
      sessionRequest: expect.objectContaining({ id: 1 }),
      message: "walletKit.errorXdrTooLarge",
    });

    await deliver(signXdrRequest(2, sacTransferTransactionXdr()));

    expect(requestSheet().requestEvent?.id).toBe(2);
  });

  it("rejects a stellar_signAuthEntry request with more than 100 contract calls", async () => {
    render(provider());
    await deliver(
      signAuthEntryRequest(1, authEntryPreimageXdr(wideInvocationTree(101))),
    );

    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledWith({
      sessionRequest: expect.objectContaining({ id: 1 }),
      message: "walletKit.errorTooManyInvocations",
    });
  });

  it("rejects a stellar_signXDR transaction whose authorizations hold more than 100 contract calls", async () => {
    render(provider());
    await deliver(
      signXdrRequest(1, invokeTransactionXdr(wideInvocationTree(101))),
    );

    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledWith({
      sessionRequest: expect.objectContaining({ id: 1 }),
      message: "walletKit.errorTooManyInvocations",
    });
  });

  it("lets through a stellar_signXDR transaction with 100 contract calls", async () => {
    render(provider());
    await deliver(
      signXdrRequest(1, invokeTransactionXdr(wideInvocationTree(100))),
    );

    expect(walletKitUtil.rejectSessionRequest).not.toHaveBeenCalled();
    expect(requestSheet().requestEvent?.id).toBe(1);
  });

  it("rejects a stellar_signAuthEntry request whose entry is over 65536 characters and moves on", async () => {
    render(provider());
    await deliver(signAuthEntryRequest(1, "A".repeat(65537)));

    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledWith({
      sessionRequest: expect.objectContaining({ id: 1 }),
      message: "walletKit.errorAuthEntryTooLarge",
    });

    await deliver(signXdrRequest(2, sacTransferTransactionXdr()));

    expect(requestSheet().requestEvent?.id).toBe(2);
  });

  it("clears a stellar_signXDR request it rejects for size instead of keeping it as the current request", async () => {
    render(provider());
    await deliver(signXdrRequest(1, "A".repeat(262145)));

    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalled();
    expect(requestSheet().requestEvent).toBeNull();
  });

  it("never prepares a stellar_signAuthEntry request it rejects for too many calls for display", async () => {
    const isDisplayable = jest.spyOn(signingDisplay, "isAuthEntryDisplayable");
    const entryXdr = authEntryPreimageXdr(wideInvocationTree(101));
    render(provider());
    await deliver(signAuthEntryRequest(1, entryXdr));

    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalled();
    expect(requestSheet().requestEvent).toBeNull();
    expect(isDisplayable).not.toHaveBeenCalledWith(entryXdr);
  });

  it("logs a request it rejects as a warning, with the method and the reason", async () => {
    render(provider());
    await deliver(signXdrRequest(1, "A".repeat(262145)));

    expect(logger.warn).toHaveBeenCalledWith(
      "WalletKitProvider",
      "Rejected a dApp request that failed validation",
      {
        method: StellarRpcMethods.SIGN_XDR,
        errorKey: "walletKit.errorXdrTooLarge",
      },
    );
  });

  it("logs a warning when telling the dApp about a rejected request fails", async () => {
    jest
      .mocked(walletKitUtil.rejectSessionRequest)
      .mockRejectedValueOnce(new Error("relay down"));
    render(provider());
    await deliver(signXdrRequest(1, "A".repeat(262145)));

    expect(logger.warn).toHaveBeenCalledWith(
      "WalletKitProvider",
      "Failed to reject a dApp request that failed validation",
      expect.objectContaining({ message: "relay down" }),
    );
  });
});

/** A connection proposal from the dApp. */
const dappProposal = (id: number) =>
  ({
    type: WalletKitEventTypes.SESSION_PROPOSAL,
    id,
    params: {
      id,
      proposer: {
        publicKey: "proposer",
        metadata: { name: "dApp", description: "", url: DAPP_URL, icons: [] },
      },
      requiredNamespaces: {},
      optionalNamespaces: {
        stellar: {
          chains: [StellarRpcChains.TESTNET],
          methods: [],
          events: [],
        },
      },
    },
    verifyContext: { verified: { origin: DAPP_URL } },
  }) as unknown as WalletKitDuck.WalletKitSessionProposal;

/** Makes the handler's next metadata lookup throw, as an unexpected bug would. */
const failNextMetadataLookup = () =>
  jest
    .spyOn(dappMetadataHook, "getDappMetadataFromEvent")
    .mockImplementationOnce(() => {
      throw new Error("unexpected");
    });

describe("WalletKitProvider: a dApp event whose handling throws", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest
      .spyOn(walletKitUtil, "rejectSessionRequest")
      .mockResolvedValue(undefined);
    jest
      .spyOn(walletKitUtil, "rejectSessionProposal")
      .mockResolvedValue(undefined);
    mockRequestSheetProps = undefined;
    mockBlockaidOverride = null;
    useWalletKitStore.getState().clearEvent();
    useWalletKitStore.setState({ activeSessions: ACTIVE_SESSIONS });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("rejects the request, keeps running and shows the next request", async () => {
    render(provider());
    failNextMetadataLookup();
    await deliver(signXdrRequest(1, sacTransferTransactionXdr()));

    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledWith({
      sessionRequest: expect.objectContaining({ id: 1 }),
      message: "walletKit.invalidRequestTitle",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "WalletKitProvider",
      "Failed to handle a session request",
      expect.objectContaining({ message: "unexpected" }),
    );
    expect(mockToast.showToast).toHaveBeenCalledWith({
      title: "walletKit.invalidRequestTitle",
      variant: "error",
    });

    // The deferred teardown releases the queue for the next request.
    act(() => {
      jest.runOnlyPendingTimers();
    });
    await deliver(signXdrRequest(2, sacTransferTransactionXdr()));

    expect(requestSheet().requestEvent?.id).toBe(2);
    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledTimes(1);
  });

  it("doesn't bring back a rejected request when the sessions refresh during the teardown", async () => {
    render(provider());
    failNextMetadataLookup();
    await deliver(signXdrRequest(1, sacTransferTransactionXdr()));

    // A session refresh lands before the deferred teardown has run.
    await actAndSettle(() =>
      useWalletKitStore.setState({ activeSessions: { ...ACTIVE_SESSIONS } }),
    );
    await actAndSettle(() => {
      jest.runOnlyPendingTimers();
    });

    expect(mockRequestSheetProps?.requestEvent ?? null).toBeNull();
    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledTimes(1);
    expect(mockToast.showToast).toHaveBeenCalledTimes(1);
  });

  it("shows a request that arrives during the teardown once the teardown runs", async () => {
    render(provider());
    failNextMetadataLookup();
    await deliver(signXdrRequest(1, sacTransferTransactionXdr()));

    // The next request arrives before the deferred teardown has run.
    await deliver(signXdrRequest(2, sacTransferTransactionXdr()));
    await actAndSettle(() => {
      jest.runOnlyPendingTimers();
    });

    expect(requestSheet().requestEvent?.id).toBe(2);
    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledTimes(1);
  });

  it("rejects the proposal and clears it", async () => {
    render(provider());
    failNextMetadataLookup();
    await actAndSettle(() =>
      useWalletKitStore.getState().setEvent(dappProposal(7)),
    );

    expect(walletKitUtil.rejectSessionProposal).toHaveBeenCalledWith({
      sessionProposal: expect.objectContaining({ id: 7 }),
      message: "walletKit.invalidRequestTitle",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "WalletKitProvider",
      "Failed to handle a session proposal",
      expect.objectContaining({ message: "unexpected" }),
    );
    expect(mockToast.showToast).toHaveBeenCalledWith({
      title: "walletKit.invalidRequestTitle",
      variant: "error",
    });
    expect(useWalletKitStore.getState().event.type).toBe(
      WalletKitEventTypes.NONE,
    );
  });
});

describe("WalletKitProvider: a request on screen when the app closed", () => {
  const REQUEST_SHEET = AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION;
  const ON_SCREEN_KEY = STORAGE_KEYS.DAPP_REQUEST_ON_SCREEN;

  const signMessageRequest = (id: number) =>
    dappRequest(id, StellarRpcMethods.SIGN_MESSAGE, { message: "Sign in" });

  const storedRequest = async () => {
    const stored = await dataStorage.getItem(ON_SCREEN_KEY);
    return stored ? (JSON.parse(stored) as unknown) : null;
  };

  /** Lets the start check and the promises it chains settle. */
  const settle = async () => {
    await act(async () => {});
    await act(async () => {});
  };

  /** What WalletKit still holds as pending, for the start check. */
  let mockPendingRequests: { id: number; topic: string }[];
  const respondSessionRequest = jest.fn();

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest
      .spyOn(walletKitUtil, "approveSessionRequest")
      .mockResolvedValue(undefined);
    jest
      .spyOn(walletKitUtil, "rejectSessionRequest")
      .mockResolvedValue(undefined);
    mockPendingRequests = [];
    respondSessionRequest.mockResolvedValue(undefined);
    jest.replaceProperty(walletKitUtil, "walletKit", {
      getPendingSessionRequests: () => mockPendingRequests,
      respondSessionRequest,
    } as unknown as typeof walletKitUtil.walletKit);
    mockRequestSheetProps = undefined;
    mockSecuritySheetProps = undefined;
    mockPresentedSheets = [];
    mockBlockaidOverride = null;
    await dataStorage.remove(ON_SCREEN_KEY);
    useWalletKitStore.getState().clearEvent();
    useWalletKitStore.setState({ activeSessions: ACTIVE_SESSIONS });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("saves the request as on screen before it shows the request's sheet", async () => {
    let finishSave = () => {};
    jest.spyOn(dataStorage, "setItem").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    render(provider());
    await settle();
    await deliver(signMessageRequest(1));

    expect(dataStorage.setItem).toHaveBeenCalledWith(
      ON_SCREEN_KEY,
      JSON.stringify({ id: 1, topic: "topic", dappName: "dApp" }),
    );
    expect(mockPresentedSheets).toEqual([]);

    finishSave();
    await act(async () => {});

    expect(mockPresentedSheets).toEqual([REQUEST_SHEET]);
  });

  it("saves it before the Blockaid sheet shown first for a transaction it couldn't scan", async () => {
    let finishSave = () => {};
    jest.spyOn(dataStorage, "setItem").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    render(provider());
    await settle();
    await deliver(signXdrRequest(1, sacTransferTransactionXdr()));

    expect(dataStorage.setItem).toHaveBeenCalledWith(
      ON_SCREEN_KEY,
      JSON.stringify({ id: 1, topic: "topic", dappName: "dApp" }),
    );
    expect(mockPresentedSheets).toEqual([]);

    finishSave();
    await act(async () => {});

    expect(mockPresentedSheets).toEqual(["SecurityDetailBottomSheet"]);
  });

  it("still shows the request when saving it fails, and logs the failure", async () => {
    jest
      .spyOn(dataStorage, "setItem")
      .mockRejectedValue(new Error("storage full"));
    render(provider());
    await settle();
    await deliver(signMessageRequest(1));
    await settle();

    expect(mockPresentedSheets).toEqual([REQUEST_SHEET]);
    expect(logger.error).toHaveBeenCalledWith(
      "WalletKitProvider",
      "Failed to save the dApp request on screen",
      expect.objectContaining({ message: "storage full" }),
    );
  });

  it("forgets the request once it's answered", async () => {
    render(provider());
    await settle();
    await deliver(signMessageRequest(1));
    await settle();

    expect(await storedRequest()).toEqual({
      id: 1,
      topic: "topic",
      dappName: "dApp",
    });

    await actAndSettle(() => requestSheet().onConfirm());
    await settle();

    expect(await storedRequest()).toBeNull();
  });

  it("forgets the request once it's cancelled", async () => {
    render(provider());
    await settle();
    await deliver(signMessageRequest(1));
    await settle();

    expect(await storedRequest()).not.toBeNull();

    await actAndSettle(() => requestSheet().onCancelRequest());
    await settle();

    expect(await storedRequest()).toBeNull();
  });

  it("at start, rejects the pending requests of the dApp whose request was on screen, and says so", async () => {
    await dataStorage.setItem(
      ON_SCREEN_KEY,
      JSON.stringify({ id: 1, topic: "topic", dappName: "Example dApp" }),
    );
    mockPendingRequests = [
      { id: 1, topic: "topic" },
      { id: 2, topic: "topic" },
    ];
    // WalletKit replays a pending request as soon as it starts, which can be
    // before the check has run.
    useWalletKitStore.getState().setEvent(signMessageRequest(1));

    render(provider());
    await settle();

    expect(respondSessionRequest).toHaveBeenCalledTimes(2);
    expect(respondSessionRequest).toHaveBeenCalledWith({
      topic: "topic",
      response: {
        id: 1,
        jsonrpc: "2.0",
        error: {
          code: 5000,
          message: "walletKit.requestRejectedAtStartReason",
        },
      },
    });
    expect(mockToast.showToast).toHaveBeenCalledWith({
      title: "walletKit.requestRejectedAtStartTitle",
      message: "walletKit.requestRejectedAtStart (Example dApp)",
      variant: "error",
    });
    expect(mockPresentedSheets).toEqual([]);
    expect(useWalletKitStore.getState().event.type).toBe(
      WalletKitEventTypes.NONE,
    );
    expect(await storedRequest()).toBeNull();
  });

  it("drops a rejected request that WalletKit replays after the check", async () => {
    await dataStorage.setItem(
      ON_SCREEN_KEY,
      JSON.stringify({ id: 1, topic: "topic", dappName: "Example dApp" }),
    );
    mockPendingRequests = [{ id: 1, topic: "topic" }];
    render(provider());
    await settle();

    await deliver(signMessageRequest(1));
    await settle();

    expect(mockPresentedSheets).toEqual([]);
    expect(useWalletKitStore.getState().event.type).toBe(
      WalletKitEventTypes.NONE,
    );
  });

  it("shows a request only once the start check is done", async () => {
    let finishRead = () => {};
    jest.spyOn(dataStorage, "getItem").mockImplementationOnce(
      () =>
        new Promise<string | null>((resolve) => {
          finishRead = () => resolve(null);
        }),
    );
    render(provider());
    await deliver(signMessageRequest(1));
    await settle();

    expect(mockPresentedSheets).toEqual([]);

    finishRead();
    await settle();

    expect(mockPresentedSheets).toEqual([REQUEST_SHEET]);
    expect(respondSessionRequest).not.toHaveBeenCalled();
  });
});

describe("WalletKitProvider: a dApp sheet that fails to render", () => {
  const signMessageRequest = (id: number) =>
    dappRequest(id, StellarRpcMethods.SIGN_MESSAGE, { message: "Sign in" });

  /** Lets the start check and the promises it chains settle. */
  const settle = async () => {
    await act(async () => {});
    await act(async () => {});
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // React reports the caught render error; the boundary's own report is
    // what the tests check.
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest
      .spyOn(walletKitUtil, "rejectSessionRequest")
      .mockResolvedValue(undefined);
    jest
      .spyOn(walletKitUtil, "rejectSessionProposal")
      .mockResolvedValue(undefined);
    mockRequestSheetProps = undefined;
    mockPresentedSheets = [];
    mockBlockaidOverride = null;
    mockFailRequestSheet = false;
    mockFailConnectionSheet = false;
    useWalletKitStore.getState().clearEvent();
    useWalletKitStore.setState({ activeSessions: ACTIVE_SESSIONS });
  });

  afterEach(() => {
    mockFailRequestSheet = false;
    mockFailConnectionSheet = false;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("rejects a request whose sheet fails to render, closes the sheet and says so", async () => {
    render(provider());
    await settle();
    mockFailRequestSheet = true;
    await deliver(signMessageRequest(1));
    await settle();

    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledTimes(1);
    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledWith({
      sessionRequest: expect.objectContaining({ id: 1 }),
      message: "walletKit.sheetRenderFailedReason",
    });
    expect(mockToast.showToast).toHaveBeenCalledWith({
      title: "walletKit.sheetRenderFailedTitle",
      message: "walletKit.sheetRenderFailed",
      variant: "error",
    });
    expect(logger.error).toHaveBeenCalledWith(
      "DappRequestSheet",
      "Render error caught by error boundary",
      expect.objectContaining({ message: "request sheet render failed" }),
      expect.anything(),
    );

    // The teardown runs: no second rejection, no user rejection recorded,
    // and the next request shows.
    mockFailRequestSheet = false;
    await actAndSettle(() => {
      jest.runOnlyPendingTimers();
    });

    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledTimes(1);
    expect(analytics.trackSignedMessageRejected).not.toHaveBeenCalled();

    await deliver(signMessageRequest(2));
    await settle();

    expect(requestSheet().requestEvent?.id).toBe(2);
  });

  it("rejects a connection whose sheet fails to render, closes the sheet and says so", async () => {
    render(provider());
    await settle();
    mockFailConnectionSheet = true;
    await actAndSettle(() =>
      useWalletKitStore.getState().setEvent(dappProposal(7)),
    );

    expect(walletKitUtil.rejectSessionProposal).toHaveBeenCalledTimes(1);
    expect(walletKitUtil.rejectSessionProposal).toHaveBeenCalledWith({
      sessionProposal: expect.objectContaining({ id: 7 }),
      message: "walletKit.sheetRenderFailedReason",
    });
    expect(mockToast.showToast).toHaveBeenCalledWith({
      title: "walletKit.sheetRenderFailedTitle",
      message: "walletKit.sheetRenderFailed",
      variant: "error",
    });
    expect(useWalletKitStore.getState().event.type).toBe(
      WalletKitEventTypes.NONE,
    );
  });

  // The bottom sheet library ignores dismiss() while a sheet is still
  // mounting, which is when a render error in its content is caught; the
  // sheet would then finish opening, empty.
  const dismissals = (sheet: string) =>
    mockDismissedSheets.filter((name) => name === sheet).length;

  it("closes a request sheet that failed while opening once it has opened, and not the next one", async () => {
    const REQUEST_SHEET = AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION;
    mockDismissedSheets = [];
    render(provider());
    await settle();
    mockFailRequestSheet = true;
    await deliver(signMessageRequest(1));
    await settle();
    const beforeOpened = dismissals(REQUEST_SHEET);

    act(() => mockSheetOnChange[REQUEST_SHEET](0));

    expect(dismissals(REQUEST_SHEET)).toBe(beforeOpened + 1);

    // Closed; the next request's sheet opens and stays open.
    act(() => mockSheetOnChange[REQUEST_SHEET](-1));
    mockFailRequestSheet = false;
    await actAndSettle(() => {
      jest.runOnlyPendingTimers();
    });
    await deliver(signMessageRequest(2));
    await settle();
    const beforeNext = dismissals(REQUEST_SHEET);

    act(() => mockSheetOnChange[REQUEST_SHEET](0));

    expect(requestSheet().requestEvent?.id).toBe(2);
    expect(dismissals(REQUEST_SHEET)).toBe(beforeNext);
  });

  it("closes a connection sheet that failed while opening once it has opened", async () => {
    const CONNECTION_SHEET = AnalyticsEvent.VIEW_GRANT_DAPP_ACCESS;
    mockDismissedSheets = [];
    render(provider());
    await settle();
    mockFailConnectionSheet = true;
    await actAndSettle(() =>
      useWalletKitStore.getState().setEvent(dappProposal(7)),
    );
    const beforeOpened = dismissals(CONNECTION_SHEET);

    act(() => mockSheetOnChange[CONNECTION_SHEET](0));

    expect(dismissals(CONNECTION_SHEET)).toBe(beforeOpened + 1);
  });

  it("doesn't bring back a request whose sheet failed when the sessions refresh during the teardown", async () => {
    render(provider());
    await settle();
    mockFailRequestSheet = true;
    await deliver(signMessageRequest(1));
    await settle();

    // A session refresh lands before the deferred teardown has run.
    await actAndSettle(() =>
      useWalletKitStore.setState({ activeSessions: { ...ACTIVE_SESSIONS } }),
    );
    await actAndSettle(() => {
      jest.runOnlyPendingTimers();
    });
    await settle();

    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledTimes(1);
    expect(mockRequestSheetProps?.requestEvent ?? null).toBeNull();
  });

  it("shows a request that arrives during the teardown of one whose sheet failed, once the teardown runs", async () => {
    render(provider());
    await settle();
    mockFailRequestSheet = true;
    await deliver(signMessageRequest(1));
    await settle();
    mockFailRequestSheet = false;

    await deliver(signMessageRequest(2));
    await actAndSettle(() => {
      jest.runOnlyPendingTimers();
    });
    await settle();

    expect(requestSheet().requestEvent?.id).toBe(2);
    expect(walletKitUtil.rejectSessionRequest).toHaveBeenCalledTimes(1);
  });
});
