import { act, render } from "@testing-library/react-native";
import {
  sacTransferPreimageXdr,
  sacTransferTransactionXdr,
} from "__tests__/support/sacTransferFixtures";
import type { SecurityDetailBottomSheetProps } from "components/blockaid";
import type DappRequestBottomSheetContent from "components/screens/WalletKit/DappRequestBottomSheetContent";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { AUTH_STATUS } from "config/types";
import type * as WalletKitDuck from "ducks/walletKit";
import * as signingDisplay from "helpers/signingDisplay";
import * as walletKitUtil from "helpers/walletKitUtil";
import { WalletKitProvider } from "providers/WalletKitProvider";
import React from "react";
import { SecurityContext, SecurityLevel } from "services/blockaid/constants";

type RequestSheetProps = React.ComponentProps<
  typeof DappRequestBottomSheetContent
>;

/** The props the request sheet last rendered with. */
let mockRequestSheetProps: RequestSheetProps | undefined;
/** The props the Blockaid sheet last rendered with. */
let mockSecuritySheetProps: SecurityDetailBottomSheetProps | undefined;
/** The Blockaid verdict the debug store forces, or null for none. */
let mockBlockaidOverride: SecurityLevel | null = null;

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
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
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
  analytics: { trackSignedTransactionRejected: jest.fn() },
}));

// Every sheet renders its content as if presented. The request sheet and the
// Blockaid sheet record their props, which is what the test drives.
jest.mock("components/BottomSheet", () => ({
  __esModule: true,
  default: ({ customContent }: { customContent: React.ReactNode }) =>
    customContent,
}));
jest.mock("components/screens/WalletKit/DappRequestBottomSheetContent", () => ({
  __esModule: true,
  default: (props: RequestSheetProps) => {
    mockRequestSheetProps = props;
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
  () => ({ __esModule: true, default: () => null }),
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
    act(() => {
      jest.advanceTimersByTime(200);
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
