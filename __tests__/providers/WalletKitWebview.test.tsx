/* eslint-disable @typescript-eslint/require-await -- Async act flushes provider effects and promise continuations. */
import { act, cleanup, render } from "@testing-library/react-native";
import {
  DappApprovalKind,
  DappErrorCode,
  type DappRequest,
  DappTransport,
} from "config/dappRequest";
import { useDappApprovalStore } from "ducks/dappApproval";
import { StellarRpcMethods } from "ducks/walletKit";
import { executeDappRequest, rejectDappRequest } from "helpers/walletKitUtil";
import { useBlockaidSite } from "hooks/blockaid/useBlockaidSite";
import { WalletKitProvider } from "providers/WalletKitProvider";
import React from "react";

type Sheet = {
  content: { props: Record<string, any>; type: string };
  present: jest.Mock;
  dismiss: jest.Mock;
  onDismiss?: () => void;
};
const mockSheets = new Map<string, Sheet>();

// Keep the real provider/coordinator; replace only native modal presentation.
jest.mock("components/BottomSheet", () => ({
  __esModule: true,
  default: (props: any) => {
    const key = props.customContent.type;
    let sheet = mockSheets.get(key);
    if (!sheet) {
      sheet = {
        content: props.customContent,
        present: jest.fn(),
        dismiss: jest.fn(),
      };
      mockSheets.set(key, sheet);
    }
    sheet.content = props.customContent;
    sheet.onDismiss = props.bottomSheetModalProps?.onDismiss;
    const { modalRef } = props;
    modalRef.current = sheet;
    return null;
  },
}));
jest.mock(
  "components/screens/WalletKit/DappConnectionBottomSheetContent",
  () => "connection",
);
jest.mock(
  "components/screens/WalletKit/DappRequestBottomSheetContent",
  () => "request",
);
jest.mock("components/AddMemoExplanationBottomSheet", () => "memo");
jest.mock("components/InformationBottomSheet", () => "information");
jest.mock("components/blockaid", () => ({
  SecurityDetailBottomSheet: "warning",
}));
jest.mock("components/sds/Icon", () => ({ InfoCircle: () => null }));
jest.mock(
  "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails",
  () => ({ useSignTransactionDetails: () => ({}) }),
);
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({
    network: "TESTNET",
    authStatus: "AUTHENTICATED",
  }),
}));
jest.mock("ducks/debug", () => ({ useDebugStore: () => ({}) }));
jest.mock("ducks/transactionSettings", () => ({
  useTransactionSettingsStore: () => ({
    transactionMemo: "",
    saveMemo: jest.fn(),
  }),
}));
jest.mock("hooks/useWalletKitInitialize", () => ({
  useWalletKitInitialize: () => true,
}));
jest.mock("hooks/useWalletKitEventsManager", () => ({
  useWalletKitEventsManager: jest.fn(),
}));
jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({
    account: { publicKey: "GACCOUNT" },
    signTransaction: jest.fn(),
    signMessage: jest.fn(),
    signAuthEntry: jest.fn(),
  }),
}));
jest.mock("hooks/useValidateTransactionMemo", () => ({
  useValidateTransactionMemo: () => ({
    isMemoMissing: false,
    isValidatingMemo: false,
  }),
}));
jest.mock("hooks/useDappMetadata", () => ({
  getDappMetadataFromEvent: jest.fn(),
}));
jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({ themeColors: { foreground: { primary: "black" } } }),
}));
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));
jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));
jest.mock("hooks/blockaid/useBlockaidSite", () => ({
  useBlockaidSite: jest.fn(),
}));
jest.mock("hooks/blockaid/useBlockaidTransaction", () => ({
  useBlockaidTransaction: () => ({
    scanTransaction: jest.fn().mockResolvedValue({ status: "safe" }),
  }),
}));
jest.mock("helpers/walletKitUtil", () => ({
  executeDappRequest: jest.fn(),
  rejectDappRequest: jest.fn(({ sessionRequest, message, code }) =>
    sessionRequest.respond({
      id: sessionRequest.id,
      jsonrpc: "2.0",
      error: { code, message },
    }),
  ),
  resolveDappRejectionEvent: () => undefined,
}));
jest.mock("helpers/walletKitValidation", () => ({
  validateSignMessageContent: (value: string) => ({ valid: true, value }),
  validateSignMessageLength: () => ({ valid: true }),
}));
jest.mock("services/blockaid/helper", () => ({
  assessSiteSecurity: (result: { status?: string } | undefined) => ({
    isMalicious: result?.status === "malicious",
    isSuspicious: false,
    isUnableToScan: result?.status !== "safe" && result?.status !== "malicious",
  }),
  assessTransactionSecurity: () => ({
    isMalicious: false,
    isSuspicious: false,
    isUnableToScan: false,
  }),
  extractSecurityWarnings: () => [],
}));

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const makeRequest = (id: string): DappRequest => ({
  id,
  transport: DappTransport.WEBVIEW,
  origin: "https://example.com",
  metadata: {
    name: "example",
    description: "",
    url: "https://example.com",
    icons: [],
  },
  params: {
    chainId: "stellar:testnet",
    request: {
      method: StellarRpcMethods.SIGN_MESSAGE,
      params: { message: "hello" },
    },
  },
  isValid: () => true,
  respond: jest.fn(async () => {
    useDappApprovalStore.setState({ job: null });
  }),
});
const enqueue = async (
  request: DappRequest,
  kind: DappApprovalKind = DappApprovalKind.SIGN,
) => {
  await act(async () => {
    useDappApprovalStore.setState({
      job: { request, kind },
      walletConnectBusy: kind === DappApprovalKind.SIGN,
    });
  });
};
const sheet = (name: string) => mockSheets.get(name)!;

describe("WalletKit WebView approval lifecycle", () => {
  const scanSite = jest.fn();
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSheets.clear();
    useDappApprovalStore.setState({ job: null, walletConnectBusy: false });
    scanSite.mockResolvedValue({ status: "safe" });
    jest
      .mocked(useBlockaidSite)
      .mockReturnValue({ scanSite } as unknown as ReturnType<
        typeof useBlockaidSite
      >);
    render(<WalletKitProvider>{null}</WalletKitProvider>);
  });
  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("executes only once when approve is delivered twice before a render", async () => {
    const pending = deferred();
    jest.mocked(executeDappRequest).mockReturnValue(pending.promise);
    await enqueue(makeRequest("first"));
    expect(sheet("request").present).toHaveBeenCalledTimes(1);
    const confirm = sheet("request").content.props.onConfirm;
    act(() => {
      confirm();
      confirm();
    });
    expect(executeDappRequest).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
  });

  it("a canceled submission finishing later cannot dismiss the next approval", async () => {
    const pending = deferred();
    jest.mocked(executeDappRequest).mockReturnValue(pending.promise);
    const first = makeRequest("first");
    first.params.request = {
      method: StellarRpcMethods.SIGN_AND_SUBMIT_XDR,
      params: { xdr: "scanned-xdr" },
    };
    await enqueue(first);
    act(() => sheet("request").content.props.onConfirm());
    await act(async () => {
      useDappApprovalStore.setState({ job: null });
    });
    act(() => jest.advanceTimersByTime(200));
    const second = makeRequest("second");
    await enqueue(second);
    const dismissCount = sheet("request").dismiss.mock.calls.length;
    await act(async () => pending.resolve());
    act(() => jest.advanceTimersByTime(200));
    expect(sheet("request").dismiss).toHaveBeenCalledTimes(dismissCount);
    expect(sheet("request").content.props.requestEvent.id).toBe(second.id);
    expect(useDappApprovalStore.getState().job?.request).toBe(second);
    expect(second.respond).not.toHaveBeenCalled();
  });

  it("connects a safe site without presenting a connection approval", async () => {
    const request = makeRequest("connect");
    await enqueue(request, DappApprovalKind.SITE);
    expect(scanSite).toHaveBeenCalledWith(request.origin);
    expect(request.respond).toHaveBeenCalledWith({
      id: request.id,
      jsonrpc: "2.0",
      result: true,
    });
    expect(sheet("connection").present).not.toHaveBeenCalled();
    expect(sheet("warning").present).not.toHaveBeenCalled();
  });

  it("rejects a site warning dismissed by a gesture", async () => {
    scanSite.mockResolvedValue({ status: "malicious" });
    const request = makeRequest("connect");
    await enqueue(request, DappApprovalKind.SITE);
    expect(sheet("warning").present).toHaveBeenCalledTimes(1);
    expect(request.respond).not.toHaveBeenCalled();
    await act(async () => sheet("warning").onDismiss?.());
    expect(rejectDappRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionRequest: request,
        code: DappErrorCode.USER_REJECTED,
      }),
    );
    expect(useDappApprovalStore.getState().job).toBeNull();
    expect(sheet("connection").present).not.toHaveBeenCalled();
  });

  it("keeps explicit site acknowledgment successful when its sheet dismisses", async () => {
    scanSite.mockResolvedValue({ status: "malicious" });
    const request = makeRequest("acknowledge");
    await enqueue(request, DappApprovalKind.SITE);
    await act(async () => sheet("warning").content.props.onProceedAnyway());
    await act(async () => sheet("warning").onDismiss?.());
    expect(request.respond).toHaveBeenCalledTimes(1);
    expect(request.respond).toHaveBeenCalledWith({
      id: request.id,
      jsonrpc: "2.0",
      result: true,
    });
    expect(rejectDappRequest).not.toHaveBeenCalled();
    expect(sheet("connection").present).not.toHaveBeenCalled();
  });
});
