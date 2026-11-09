/**
 * The pre-flight and the render, compared on the same input.
 *
 * `helpers/signingDisplay` dry-runs the conversions the details make that can
 * throw, so that a request it passes can be shown. Here a transaction the
 * pre-flight calls `ready` is rendered by the real details sheet, and an auth
 * entry it calls displayable by the real auth-entry display, across the shared
 * fixtures' recipients. Neither may trip its error boundary.
 */
import {
  Networks,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { act } from "@testing-library/react-native";
import {
  BASE_CONTRACT,
  G_ACCOUNT,
  M_ACCOUNT_ID_1234,
  MUXED_CONTRACT_ID_0,
  MUXED_CONTRACT_ID_1234,
  MUXED_CONTRACT_ID_U64_MAX,
} from "__tests__/support/muxedContractFixtures";
import {
  sacTransferPreimageXdr,
  sacTransferTransactionXdr,
} from "__tests__/support/sacTransferFixtures";
import SignTransactionDetailsBottomSheet from "components/screens/SignTransactionDetails/components/SignTransactionDetailsBottomSheet";
import { buildSignTransactionDetailsState } from "components/screens/SignTransactionDetails/hooks/useSignTransactionDetails";
import { SignTransactionDetailsState } from "components/screens/SignTransactionDetails/types";
import { DappAuthEntryDisplay } from "components/screens/WalletKit/DappAuthEntryDisplay";
import { OPERATION_TYPES, VISUAL_DELAY_MS } from "config/constants";
import { logger } from "config/logger";
import { isAuthEntryDisplayable } from "helpers/signingDisplay";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

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

// No contract spec, so the parameters render unnamed and nothing waits on one.
jest.mock("services/backend", () => ({
  getContractSpecs: jest.fn().mockRejectedValue(new Error("no spec")),
}));

// Every collapsible renders open, so the render makes every conversion the
// details can show, as if the user opened each authorization.
jest.mock("components/CollapsibleSection", () => ({
  __esModule: true,
  default: ({
    header,
    children,
  }: {
    header: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <>
      {header}
      {children}
    </>
  ),
}));

type ReadyState = Extract<SignTransactionDetailsState, { status: "ready" }>;

/** Every kind of recipient the shared fixtures have an address for. */
const RECIPIENTS: [string, string][] = [
  ["a muxed contract (W) with mux id 1234", MUXED_CONTRACT_ID_1234],
  ["a muxed contract (W) with mux id 0", MUXED_CONTRACT_ID_0],
  ["a muxed contract (W) with the largest mux id", MUXED_CONTRACT_ID_U64_MAX],
  ["a contract (C)", BASE_CONTRACT],
  ["an account (G)", G_ACCOUNT],
  ["a muxed account (M)", M_ACCOUNT_ID_1234],
];

/** A fee bump that G_ACCOUNT pays for, wrapping `inner`. */
const feeBumpXdr = (inner: string) =>
  TransactionBuilder.buildFeeBumpTransaction(
    G_ACCOUNT,
    "200",
    TransactionBuilder.fromXdr(inner, Networks.TESTNET) as Transaction,
    Networks.TESTNET,
  ).toXdr();

/**
 * Renders the details of `envelope`, which the pre-flight must call `ready`.
 * Runs the short delay after which the operations render, and lets their
 * failed spec lookup settle.
 */
const renderReadyDetails = async (envelope: string) => {
  const state = buildSignTransactionDetailsState(envelope, Networks.TESTNET);
  expect(state.status).toBe("ready");

  const onRenderError = jest.fn();
  const view = renderWithProviders(
    <SignTransactionDetailsBottomSheet
      data={(state as ReadyState).details}
      onRenderError={onRenderError}
    />,
  );
  act(() => {
    jest.advanceTimersByTime(VISUAL_DELAY_MS);
  });
  await act(async () => {});

  return { ...view, onRenderError };
};

describe.each(RECIPIENTS)("a SAC transfer to %s", (_, to) => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(logger.error).mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the transaction's details, which the pre-flight calls ready, without tripping the boundary", async () => {
    const { getByText, onRenderError, queryByTestId } =
      await renderReadyDetails(sacTransferTransactionXdr(to));

    expect(onRenderError).not.toHaveBeenCalled();
    expect(queryByTestId("unreadable-transaction-notice")).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
    // The operations rendered, not just their placeholder.
    expect(getByText(OPERATION_TYPES.invokeHostFunction)).toBeTruthy();
  });

  it("renders a fee bump's details, which the pre-flight calls ready, without tripping the boundary", async () => {
    const { getByText, onRenderError, queryByTestId } =
      await renderReadyDetails(feeBumpXdr(sacTransferTransactionXdr(to)));

    expect(onRenderError).not.toHaveBeenCalled();
    expect(queryByTestId("unreadable-transaction-notice")).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
    expect(getByText(OPERATION_TYPES.invokeHostFunction)).toBeTruthy();
  });

  it("renders the auth entry, which the pre-flight calls displayable, without tripping a boundary", () => {
    const entryXdr = sacTransferPreimageXdr(to);
    expect(isAuthEntryDisplayable(entryXdr)).toBe(true);

    const onRenderError = jest.fn();
    const { queryByTestId } = renderWithProviders(
      <DappAuthEntryDisplay
        entryXdr={entryXdr}
        expandAll
        onRenderError={onRenderError}
      />,
    );

    expect(onRenderError).not.toHaveBeenCalled();
    expect(queryByTestId("unreadable-transaction-notice")).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });
});
