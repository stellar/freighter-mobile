/**
 * A request sheet's nested details sheet, when the request fails closed while
 * that sheet is opening.
 *
 * A render error in Transaction details or Authorization Entry Details fails
 * the request closed: the request sheet's content switches to the unreadable
 * notice and Cancel, which unmounts the details button that owns the nested
 * sheet. That sheet is still opening when it happens, and
 * patches/@gorhom+bottom-sheet+5.2.6.patch makes gorhom close it then too.
 * Without the patch the sheet stays on screen, and its close button does
 * nothing.
 *
 * The request sheet suites stub the details components module-wide, so these
 * cases have their own file: they render the real details owners and the real
 * gorhom modal.
 */
import { act, fireEvent } from "@testing-library/react-native";
import { sacTransferPreimageXdr } from "__tests__/support/sacTransferFixtures";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import { DappSignAuthEntryBottomSheetContent } from "components/screens/WalletKit/DappSignAuthEntryBottomSheetContent";
import { DappSignTransactionBottomSheetContent } from "components/screens/WalletKit/DappSignTransactionBottomSheetContent";
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

/** Commits whatever the last interaction scheduled, such as the portal's mount. */
const flush = () => act(() => {});

describe("a request sheet's nested details sheet, when the request fails closed while it opens", () => {
  const onCancelRequest = jest.fn();
  const onConfirm = jest.fn();
  const onDetailsRenderError = jest.fn();

  beforeEach(() => {
    // gorhom's present() mounts the modal in a requestAnimationFrame callback.
    // Running that callback at once, with fake timers that are never advanced,
    // mounts the sheet without running its open animation. Advancing them
    // would start Reanimated's mappers, which reach native modules Jest
    // doesn't have. So the sheet is still opening when the request flips, as
    // it is on a device when its content throws while it opens.
    jest.useFakeTimers();
    jest
      .spyOn(global, "requestAnimationFrame")
      .mockImplementation((callback: (time: number) => void) => {
        callback(0);
        return 0;
      });
    // React logs every error a boundary catches; the boundary's callback is
    // asserted on instead, so the log would only be noise.
    jest.spyOn(console, "error").mockImplementation(() => {});
    // So would gorhom's warning that the sheet's scroll view has no native
    // handle, which a test renderer never gives it. Other warnings still show.
    const { warn } = console;
    jest.spyOn(console, "warn").mockImplementation((...args) => {
      if (args[0] !== "Couldn't find the scrollable node handle id!") {
        warn(...args);
      }
    });
    jest.clearAllMocks();
    jest
      .mocked(scValToDisplayTokens)
      .mockReset()
      .mockImplementation(actualSoroban.scValToDisplayTokens);
    mockSummaryThrows = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("closes Transaction details", () => {
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
    const {
      getByTestId,
      getByText,
      queryAllByTestId,
      queryAllByText,
      rerender,
    } = renderWithProviders(sheet(false));

    fireEvent.press(
      getByText("dappRequestBottomSheetContent.transactionDetails"),
    );
    flush();

    // The details sheet opened, and its boundary tripped.
    expect(onDetailsRenderError).toHaveBeenCalledTimes(1);
    expect(queryAllByTestId("unreadable-transaction-notice")).toHaveLength(1);

    // What the provider does in response: the request fails closed.
    rerender(sheet(true));
    flush();

    // Only the request sheet's notice is left: the details sheet is gone.
    expect(queryAllByTestId("unreadable-transaction-notice")).toHaveLength(1);
    expect(queryAllByText("signTransactionDetails.title")).toHaveLength(0);
    expect(getByTestId("dapp-request-cancel-button")).toBeTruthy();
  });

  it("closes Authorization Entry Details", () => {
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
    const {
      getByTestId,
      getByText,
      queryAllByTestId,
      queryAllByText,
      rerender,
    } = renderWithProviders(sheet(false));

    fireEvent.press(
      getByText("dappRequestBottomSheetContent.authEntryDetails"),
    );
    flush();

    // The details sheet opened, and its boundary tripped.
    expect(onDetailsRenderError).toHaveBeenCalledTimes(1);
    expect(queryAllByTestId("unreadable-transaction-notice")).toHaveLength(1);

    // What the provider does in response: the request fails closed.
    rerender(sheet(true));
    flush();

    // Only the request sheet's notice is left: the details sheet, and the
    // button that opened it, are gone.
    expect(queryAllByTestId("unreadable-transaction-notice")).toHaveLength(1);
    expect(
      queryAllByText("dappRequestBottomSheetContent.authEntryDetails"),
    ).toHaveLength(0);
    expect(getByTestId("dapp-request-cancel-button")).toBeTruthy();
  });
});
