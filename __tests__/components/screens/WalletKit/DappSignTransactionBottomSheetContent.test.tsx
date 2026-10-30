import { fireEvent } from "@testing-library/react-native";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import { DappSignTransactionBottomSheetContent } from "components/screens/WalletKit/DappSignTransactionBottomSheetContent";
import { TESTNET_NETWORK_DETAILS } from "config/constants";
import { ActiveAccount } from "ducks/auth";
import {
  StellarRpcChains,
  StellarRpcMethods,
  WalletKitSessionRequest,
} from "ducks/walletKit";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

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

/** The props the details last rendered with; undefined if they never rendered. */
let mockSignTransactionDetailsProps: Record<string, unknown> | undefined;

jest.mock("components/screens/SignTransactionDetails", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSignTransactionDetailsProps = props;
    return null;
  },
}));

jest.mock("components/sds/Avatar", () => () => null);

jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

const ACCOUNT: ActiveAccount = {
  publicKey: "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57",
  privateKey: "",
  accountName: "Account 1",
  id: "account-1",
  subentryCount: 0,
};

const REQUEST_EVENT = {
  id: 1,
  topic: "topic",
  params: {
    chainId: StellarRpcChains.TESTNET,
    request: { method: StellarRpcMethods.SIGN_XDR, params: { xdr: "AAAA" } },
  },
} as unknown as WalletKitSessionRequest;

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

describe("DappSignTransactionBottomSheetContent", () => {
  const onCancelRequest = jest.fn();
  const onConfirm = jest.fn();
  const onDetailsRenderError = jest.fn();

  /** Renders the sheet for a displayable request, with `overrides` on top. */
  const renderSheet = (
    overrides: Partial<
      React.ComponentProps<typeof DappSignTransactionBottomSheetContent>
    > = {},
  ) =>
    renderWithProviders(
      <DappSignTransactionBottomSheetContent
        requestEvent={REQUEST_EVENT}
        account={ACCOUNT}
        networkDetails={TESTNET_NETWORK_DETAILS}
        onCancelRequest={onCancelRequest}
        onConfirm={onConfirm}
        isSigning={false}
        signTransactionDetails={SIGN_TRANSACTION_DETAILS}
        onDetailsRenderError={onDetailsRenderError}
        {...overrides}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockSignTransactionDetailsProps = undefined;
  });

  it("offers only Cancel, which rejects, when the request can't be displayed", () => {
    const { getByTestId, getByText, queryByTestId } = renderSheet({
      isUndisplayable: true,
    });

    expect(getByTestId("unreadable-transaction-notice")).toBeTruthy();
    expect(queryByTestId("dapp-request-buttons")).toBeNull();
    // The details aren't rendered.
    expect(mockSignTransactionDetailsProps).toBeUndefined();
    // The header still says who is asking.
    expect(getByTestId("sign-transaction-title")).toBeTruthy();
    expect(getByText("localhost")).toBeTruthy();

    fireEvent.press(getByTestId("dapp-request-cancel-button"));

    expect(onCancelRequest).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("hides the Blockaid banner and Confirm anyway when an undisplayable request is also flagged", () => {
    const { queryByTestId, queryByText } = renderSheet({
      isUndisplayable: true,
      isMalicious: true,
    });

    // The banner's onPress opens the Blockaid sheet, which offers to confirm
    // anyway.
    expect(
      queryByText("dappConnectionBottomSheetContent.maliciousFlag"),
    ).toBeNull();
    expect(queryByTestId("dapp-request-buttons")).toBeNull();
  });

  it("shows the Blockaid banner on a flagged request it can display", () => {
    const { getByTestId, getByText } = renderSheet({ isMalicious: true });

    expect(
      getByText("dappConnectionBottomSheetContent.maliciousFlag"),
    ).toBeTruthy();
    expect(getByTestId("dapp-request-buttons")).toBeTruthy();
  });

  it("renders the details and the buttons when displayable, wiring the boundary callback", () => {
    const { getByTestId, queryByTestId } = renderSheet({
      isUndisplayable: false,
    });

    expect(getByTestId("dapp-request-buttons")).toBeTruthy();
    expect(queryByTestId("unreadable-transaction-notice")).toBeNull();
    expect(mockSignTransactionDetailsProps?.data).toBe(
      SIGN_TRANSACTION_DETAILS,
    );
    expect(mockSignTransactionDetailsProps?.onRenderError).toBe(
      onDetailsRenderError,
    );
  });
});
