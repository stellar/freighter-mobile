import { fireEvent } from "@testing-library/react-native";
import { sacTransferPreimageXdr } from "__tests__/support/sacTransferFixtures";
import { DappSignAuthEntryBottomSheetContent } from "components/screens/WalletKit/DappSignAuthEntryBottomSheetContent";
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

jest.mock("components/screens/WalletKit/DappRequestButtons", () => {
  const { View: MockView } = jest.requireActual("react-native");
  return {
    DappRequestButtons: () => <MockView testID="dapp-request-buttons" />,
  };
});

/** The props the details button last rendered with; undefined if it never rendered. */
let mockDetailsButtonProps: Record<string, unknown> | undefined;
/** The props the details sheet last rendered with; undefined if it never rendered. */
let mockDetailsSheetProps: Record<string, unknown> | undefined;

jest.mock("components/screens/WalletKit/DappAuthEntryDetails", () => ({
  __esModule: true,
  DappAuthEntryDetailsButton: (props: Record<string, unknown>) => {
    mockDetailsButtonProps = props;
    return null;
  },
  DappAuthEntryDetailsSheet: (props: Record<string, unknown>) => {
    mockDetailsSheetProps = props;
    return null;
  },
}));

jest.mock("hooks/useClipboard", () => ({
  useClipboard: () => ({ copyToClipboard: jest.fn() }),
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

const ENTRY_XDR = sacTransferPreimageXdr();

const REQUEST_EVENT = {
  id: 1,
  topic: "topic",
  params: {
    chainId: StellarRpcChains.TESTNET,
    request: {
      method: StellarRpcMethods.SIGN_AUTH_ENTRY,
      params: { entryXdr: ENTRY_XDR },
    },
  },
} as unknown as WalletKitSessionRequest;

describe("DappSignAuthEntryBottomSheetContent", () => {
  const onCancelRequest = jest.fn();
  const onConfirm = jest.fn();
  const onDetailsRenderError = jest.fn();

  /** Renders the sheet for a displayable auth entry, with `overrides` on top. */
  const renderSheet = (
    overrides: Partial<
      React.ComponentProps<typeof DappSignAuthEntryBottomSheetContent>
    > = {},
  ) =>
    renderWithProviders(
      <DappSignAuthEntryBottomSheetContent
        requestEvent={REQUEST_EVENT}
        account={ACCOUNT}
        networkDetails={TESTNET_NETWORK_DETAILS}
        entryXdr={ENTRY_XDR}
        onCancelRequest={onCancelRequest}
        onConfirm={onConfirm}
        isSigning={false}
        onDetailsRenderError={onDetailsRenderError}
        {...overrides}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockDetailsButtonProps = undefined;
    mockDetailsSheetProps = undefined;
  });

  it("offers only Cancel, which rejects, when the auth entry can't be displayed", () => {
    const { getByTestId, getByText, queryByTestId, queryByText } = renderSheet({
      isUndisplayable: true,
    });

    expect(getByTestId("unreadable-transaction-notice")).toBeTruthy();
    expect(queryByTestId("dapp-request-buttons")).toBeNull();
    // Neither the details button nor the raw entry show, and neither does the
    // trust text that goes with Confirm. The details sheet stays mounted, so
    // one that's open when the request fails closed stays on screen.
    expect(mockDetailsButtonProps).toBeUndefined();
    expect(mockDetailsSheetProps?.entryXdr).toBe(ENTRY_XDR);
    expect(queryByTestId("auth-entry-xdr")).toBeNull();
    expect(queryByText("blockaid.security.site.confirmTrust")).toBeNull();
    // The header still says who is asking, and for what.
    expect(getByTestId("sign-auth-entry-title")).toBeTruthy();
    expect(getByText("localhost")).toBeTruthy();

    fireEvent.press(getByTestId("dapp-request-cancel-button"));

    expect(onCancelRequest).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("words the notice for the authorization entry, not a transaction", () => {
    const { getByText, queryByText } = renderSheet({ isUndisplayable: true });

    expect(
      getByText("signTransactionDetails.unreadableAuthEntry.title"),
    ).toBeTruthy();
    expect(
      getByText("signTransactionDetails.unreadableAuthEntry.description"),
    ).toBeTruthy();
    expect(queryByText("signTransactionDetails.unreadable.title")).toBeNull();
    expect(
      queryByText("signTransactionDetails.unreadable.description"),
    ).toBeNull();
  });

  it("disables Cancel while an approval is in flight", () => {
    const { getByTestId } = renderSheet({
      isUndisplayable: true,
      isSigning: true,
    });

    const cancel = getByTestId("dapp-request-cancel-button");
    expect(cancel.props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(cancel);

    expect(onCancelRequest).not.toHaveBeenCalled();
  });

  it("hides the Blockaid banner when an undisplayable auth entry is also flagged", () => {
    const { queryByTestId, queryByText } = renderSheet({
      isUndisplayable: true,
      isMalicious: true,
    });

    expect(
      queryByText("dappConnectionBottomSheetContent.maliciousFlag"),
    ).toBeNull();
    expect(queryByTestId("dapp-request-buttons")).toBeNull();
  });

  it("shows the Blockaid banner on a flagged auth entry it can display", () => {
    const { getByTestId, getByText } = renderSheet({ isMalicious: true });

    expect(
      getByText("dappConnectionBottomSheetContent.maliciousFlag"),
    ).toBeTruthy();
    expect(getByTestId("dapp-request-buttons")).toBeTruthy();
  });

  it("passes the boundary callback to the details when displayable", () => {
    const { getByTestId, getByText, queryByTestId } = renderSheet();

    expect(getByTestId("dapp-request-buttons")).toBeTruthy();
    expect(queryByTestId("unreadable-transaction-notice")).toBeNull();
    expect(getByTestId("auth-entry-xdr")).toBeTruthy();
    expect(getByText("blockaid.security.site.confirmTrust")).toBeTruthy();
    expect(mockDetailsButtonProps).toBeDefined();
    expect(mockDetailsSheetProps?.entryXdr).toBe(ENTRY_XDR);
    expect(mockDetailsSheetProps?.onRenderError).toBe(onDetailsRenderError);
  });
});
