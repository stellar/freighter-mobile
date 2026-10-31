/**
 * A request sheet's nested details sheet, when the request fails closed while
 * that sheet is open.
 *
 * A render error in Transaction details or Authorization Entry Details fails
 * the request closed: the request sheet's content switches to the unreadable
 * notice and Cancel. The details sheet must not close itself or be left
 * orphaned when that happens. It stays open, showing its own notice, until the
 * user closes it, and then the request underneath offers only Cancel.
 *
 * The request sheet suites stub the details components module-wide, so these
 * cases have their own file: they render the real details sheets and their
 * error boundaries. `components/BottomSheet` is replaced by a stub that opens
 * and closes through the same `modalRef` and records when it mounts and
 * unmounts, which is what these cases are about.
 */
import { act, fireEvent } from "@testing-library/react-native";
import { sacTransferPreimageXdr } from "__tests__/support/sacTransferFixtures";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import { DappSignAuthEntryBottomSheetContent } from "components/screens/WalletKit/DappSignAuthEntryBottomSheetContent";
import { DappSignTransactionBottomSheetContent } from "components/screens/WalletKit/DappSignTransactionBottomSheetContent";
import { AnalyticsEvent } from "config/analyticsConfig";
import { TESTNET_NETWORK_DETAILS } from "config/constants";
import { ActiveAccount } from "ducks/auth";
import {
  StellarRpcChains,
  StellarRpcMethods,
  WalletKitSessionRequest,
} from "ducks/walletKit";
import { scValToDisplayTokens } from "helpers/soroban";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

/** Whether the transaction summary throws while rendering. */
let mockSummaryThrows = false;

/** How many times each sheet mounted and unmounted, by its analytics event. */
const mockSheetLifecycle: Record<string, { mounts: number; unmounts: number }> =
  {};

jest.mock("components/BottomSheet", () => {
  const MockReact = jest.requireActual("react");

  const MockBottomSheet = ({
    modalRef,
    analyticsEvent,
    customContent,
    scrollViewHeaderComponent,
  }: {
    modalRef: React.Ref<unknown>;
    analyticsEvent?: string;
    customContent?: React.ReactNode;
    scrollViewHeaderComponent?: () => React.ReactNode;
  }) => {
    const [isOpen, setIsOpen] = MockReact.useState(false);
    const key = analyticsEvent ?? "unnamed";

    MockReact.useEffect(() => {
      mockSheetLifecycle[key] ??= { mounts: 0, unmounts: 0 };
      mockSheetLifecycle[key].mounts += 1;

      return () => {
        mockSheetLifecycle[key].unmounts += 1;
      };
    }, [key]);

    // Opens and closes through the same ref gorhom's modal exposes.
    MockReact.useImperativeHandle(modalRef, () => ({
      present: () => setIsOpen(true),
      dismiss: () => setIsOpen(false),
    }));

    return isOpen ? (
      <>
        {scrollViewHeaderComponent?.()}
        {customContent}
      </>
    ) : null;
  };

  return { __esModule: true, default: MockBottomSheet };
});

jest.mock("components/screens/WalletKit/useDappHeader", () => ({
  useDappHeader: () => ({
    dAppName: "Mock dApp",
    dAppFavicon: "",
    dAppDomain: "localhost",
  }),
}));

jest.mock("hooks/blockaid/useTransactionBalanceListItems", () => ({
  useTransactionBalanceListItems: () => [],
}));

jest.mock("components/screens/WalletKit/DappRequestButtons", () => {
  const { View: MockView } = jest.requireActual("react-native");
  return {
    DappRequestButtons: () => <MockView testID="dapp-request-buttons" />,
  };
});

jest.mock(
  "components/screens/SignTransactionDetails/components/SignTransactionSummary",
  () => {
    const { Text: MockText } = jest.requireActual("react-native");
    return {
      __esModule: true,
      default: () => {
        if (mockSummaryThrows) {
          throw new Error("summary render failed");
        }
        return <MockText>summary</MockText>;
      },
    };
  },
);

jest.mock("components/sds/Avatar", () => () => null);

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: jest.fn() }),
}));

jest.mock("ducks/auth", () => ({
  useAuthenticationStore: () => ({ network: "TESTNET" }),
}));

jest.mock("services/backend", () => ({ getContractSpecs: jest.fn() }));

// The token conversion is wrapped so the auth entry's arguments can throw,
// which is what an arm the app can't render does. It calls through by default.
jest.mock("helpers/soroban", () => {
  const actual = jest.requireActual("helpers/soroban");
  return {
    ...actual,
    scValToDisplayTokens: jest.fn(actual.scValToDisplayTokens),
  };
});

const actualSoroban = jest.requireActual("helpers/soroban");

const ACCOUNT: ActiveAccount = {
  publicKey: "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57",
  privateKey: "",
  accountName: "Account 1",
  id: "account-1",
  subentryCount: 0,
};

const SIGN_XDR_REQUEST = {
  id: 1,
  topic: "topic",
  params: {
    chainId: StellarRpcChains.TESTNET,
    request: { method: StellarRpcMethods.SIGN_XDR, params: { xdr: "AAAA" } },
  },
} as unknown as WalletKitSessionRequest;

/** Details with only a summary, so the summary is the only section that renders. */
const SIGN_TRANSACTION_DETAILS: SignTransactionDetailsInterface = {
  summary: {
    operationsCount: 1,
    feeXlm: "0.00001",
    sequenceNumber: "1",
    memo: null,
    xdr: "AAAA",
  },
  authEntries: [],
  operations: [],
  hasTrustlineChanges: false,
};

const ENTRY_XDR = sacTransferPreimageXdr();

const SIGN_AUTH_ENTRY_REQUEST = {
  id: 2,
  topic: "topic",
  params: {
    chainId: StellarRpcChains.TESTNET,
    request: {
      method: StellarRpcMethods.SIGN_AUTH_ENTRY,
      params: { entryXdr: ENTRY_XDR },
    },
  },
} as unknown as WalletKitSessionRequest;

const TRANSACTION_DETAILS_SHEET =
  AnalyticsEvent.VIEW_SIGN_DAPP_TRANSACTION_DETAILS;
const AUTH_ENTRY_DETAILS_SHEET =
  AnalyticsEvent.VIEW_SIGN_DAPP_AUTH_ENTRY_DETAILS;

describe("a request sheet's nested details sheet, when the request fails closed while it's open", () => {
  const onCancelRequest = jest.fn();
  const onConfirm = jest.fn();
  const onDetailsRenderError = jest.fn();

  beforeEach(() => {
    // React logs every error a boundary catches; the boundary's callback is
    // asserted on instead, so the log would only be noise.
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.clearAllMocks();
    jest
      .mocked(scValToDisplayTokens)
      .mockReset()
      .mockImplementation(actualSoroban.scValToDisplayTokens);
    mockSummaryThrows = false;
    Object.keys(mockSheetLifecycle).forEach((key) => {
      delete mockSheetLifecycle[key];
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("keeps Transaction details open with its notice, and Cancel only underneath once closed", () => {
    // The summary throws on the details sheet's first render.
    mockSummaryThrows = true;
    const sheet = (isUndisplayable: boolean) => (
      <DappSignTransactionBottomSheetContent
        requestEvent={SIGN_XDR_REQUEST}
        account={ACCOUNT}
        networkDetails={TESTNET_NETWORK_DETAILS}
        onCancelRequest={onCancelRequest}
        onConfirm={onConfirm}
        isSigning={false}
        signTransactionDetails={SIGN_TRANSACTION_DETAILS}
        onDetailsRenderError={onDetailsRenderError}
        isUndisplayable={isUndisplayable}
      />
    );
    const { getByTestId, getByText, queryAllByTestId, queryByText, rerender } =
      renderWithProviders(sheet(false));

    act(() => {
      fireEvent.press(
        getByText("dappRequestBottomSheetContent.transactionDetails"),
      );
    });

    // The details sheet opened, and its boundary tripped.
    expect(onDetailsRenderError).toHaveBeenCalledTimes(1);
    expect(queryAllByTestId("unreadable-transaction-notice")).toHaveLength(1);

    // What the provider does in response: the request fails closed.
    rerender(sheet(true));

    // The details sheet is still the same, still open, with its notice; the
    // request underneath now shows its own notice and Cancel.
    expect(mockSheetLifecycle[TRANSACTION_DETAILS_SHEET]).toEqual({
      mounts: 1,
      unmounts: 0,
    });
    expect(getByText("signTransactionDetails.title")).toBeTruthy();
    expect(queryAllByTestId("unreadable-transaction-notice")).toHaveLength(2);
    expect(getByTestId("dapp-request-cancel-button")).toBeTruthy();
    // The button that opened it is gone with the rest of the request.
    expect(
      queryByText("dappRequestBottomSheetContent.transactionDetails"),
    ).toBeNull();

    // Its close button still works, and leaves the request's notice and
    // Cancel.
    act(() => {
      fireEvent.press(getByTestId("sign-transaction-details-close-button"));
    });

    expect(queryByText("signTransactionDetails.title")).toBeNull();
    expect(queryAllByTestId("unreadable-transaction-notice")).toHaveLength(1);
    expect(getByTestId("dapp-request-cancel-button")).toBeTruthy();
  });

  it("keeps Authorization Entry Details open with its notice, and Cancel only underneath once closed", () => {
    // The details show every invocation expanded, so the arguments convert,
    // and throw, on the sheet's first render.
    jest.mocked(scValToDisplayTokens).mockImplementation(() => {
      throw new Error("unsupported arm");
    });
    const sheet = (isUndisplayable: boolean) => (
      <DappSignAuthEntryBottomSheetContent
        requestEvent={SIGN_AUTH_ENTRY_REQUEST}
        account={ACCOUNT}
        networkDetails={TESTNET_NETWORK_DETAILS}
        entryXdr={ENTRY_XDR}
        onCancelRequest={onCancelRequest}
        onConfirm={onConfirm}
        isSigning={false}
        onDetailsRenderError={onDetailsRenderError}
        isUndisplayable={isUndisplayable}
      />
    );
    const { getByTestId, queryAllByTestId, queryByTestId, rerender } =
      renderWithProviders(sheet(false));

    act(() => {
      fireEvent.press(getByTestId("dapp-auth-entry-details-button"));
    });

    // The details sheet opened, and its boundary tripped.
    expect(onDetailsRenderError).toHaveBeenCalledTimes(1);
    expect(queryAllByTestId("unreadable-transaction-notice")).toHaveLength(1);

    // What the provider does in response: the request fails closed.
    rerender(sheet(true));

    expect(mockSheetLifecycle[AUTH_ENTRY_DETAILS_SHEET]).toEqual({
      mounts: 1,
      unmounts: 0,
    });
    expect(queryAllByTestId("unreadable-transaction-notice")).toHaveLength(2);
    expect(getByTestId("dapp-request-cancel-button")).toBeTruthy();
    // The button that opened it is gone with the rest of the request. (The
    // sheet's own header uses the same words, so the button is found by id.)
    expect(queryByTestId("dapp-auth-entry-details-button")).toBeNull();

    act(() => {
      fireEvent.press(getByTestId("dapp-auth-entry-details-close-button"));
    });

    expect(queryAllByTestId("unreadable-transaction-notice")).toHaveLength(1);
    expect(getByTestId("dapp-request-cancel-button")).toBeTruthy();
  });

  it("mounts no details sheet for a request that can't be displayed from the start", () => {
    const { getByTestId } = renderWithProviders(
      <DappSignTransactionBottomSheetContent
        requestEvent={SIGN_XDR_REQUEST}
        account={ACCOUNT}
        networkDetails={TESTNET_NETWORK_DETAILS}
        onCancelRequest={onCancelRequest}
        onConfirm={onConfirm}
        isSigning={false}
        signTransactionDetails={null}
        onDetailsRenderError={onDetailsRenderError}
        isUndisplayable
      />,
    );

    expect(getByTestId("dapp-request-cancel-button")).toBeTruthy();
    expect(mockSheetLifecycle[TRANSACTION_DETAILS_SHEET]).toBeUndefined();
  });
});
