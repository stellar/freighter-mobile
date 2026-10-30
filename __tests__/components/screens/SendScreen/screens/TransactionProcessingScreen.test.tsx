/* eslint-disable @fnando/consistent-import/consistent-import */
import {
  BASE_CONTRACT,
  MUXED_CONTRACT_ID_0,
} from "__tests__/support/muxedContractFixtures";
import { SendType } from "components/screens/SendScreen/components/SendReviewBottomSheet";
import TransactionProcessingScreen from "components/screens/SendScreen/screens/TransactionProcessingScreen";
import { AnalyticsEvent, AnalyticsFlow } from "config/analyticsConfig";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { track } from "services/analytics/core";

import { mockUseColors } from "../../../../../__mocks__/use-colors";

mockUseColors();

const mockDefaultRecipientAddress =
  "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF";
// Mutable so a test can send to another recipient.
let mockRecipientAddress = mockDefaultRecipientAddress;

// The store hooks pull in native/persisted state; stub them with the minimal
// shape TransactionProcessingScreen reads so we can mount it in isolation.
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(() => ({
    network: "TESTNET",
    allAccounts: [],
  })),
}));
jest.mock("ducks/transactionSettings", () => ({
  useTransactionSettingsStore: jest.fn(() => ({
    recipientAddress: mockRecipientAddress,
    federationAddress: "",
    recipientName: "",
  })),
}));
jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: jest.fn(() => ({
    isSubmitting: true,
    transactionHash: null,
    error: null,
    resetTransaction: jest.fn(),
  })),
}));
jest.mock("ducks/sendRecipient", () => ({
  useSendRecipientStore: jest.fn(() => ({
    addRecentAddress: jest.fn(),
  })),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => key,
}));

// The component only reads navigation.setOptions; the global mock omits it.
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

// Heavy presentational children are irrelevant to the emission under test.
jest.mock("components/BottomSheet", () => () => null);
jest.mock("components/TransactionDetailsBottomSheet", () => () => null);
jest.mock("components/CollectibleImage", () => ({
  CollectibleImage: () => null,
}));
jest.mock("components/TokenIcon", () => ({ TokenIcon: () => null }));
jest.mock("components/Spinner", () => () => null);
jest.mock("components/layout/BaseLayout", () => ({
  BaseLayout: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("components/sds/Avatar", () => () => null);
jest.mock("components/sds/Button", () => ({ Button: () => null }));
// The status and the message render through Display and Text, so these render
// their children, for a test to read.
jest.mock("components/sds/Typography", () => {
  const { createElement } = jest.requireActual<typeof import("react")>("react");
  const { Text: NativeText } =
    jest.requireActual<typeof import("react-native")>("react-native");
  const RenderChildren = ({ children }: { children?: React.ReactNode }) =>
    createElement(NativeText, null, children);

  return { Display: RenderChildren, Text: RenderChildren };
});
jest.mock("components/sds/Icon", () => ({
  __esModule: true,
  default: new Proxy({}, { get: () => "View" }),
}));

/**
 * Serves one builder state to the screen. Without a hash the submission is
 * still running, unless `isSubmitting` says otherwise.
 *
 * @param state The hash, the error and, optionally, whether it's submitting
 */
const setTransactionState = (state: {
  transactionHash: string | null;
  error?: unknown;
  isSubmitting?: boolean;
}) => {
  (useTransactionBuilderStore as unknown as jest.Mock).mockReturnValue({
    isSubmitting: state.isSubmitting ?? state.transactionHash === null,
    transactionHash: state.transactionHash,
    error: state.error ?? null,
    resetTransaction: jest.fn(),
  });
};

const screenViewedProps = () =>
  (track as jest.Mock).mock.calls
    .filter(([event]) => event === AnalyticsEvent.SCREEN_VIEWED)
    .map(([, props]) => props);

describe("TransactionProcessingScreen analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("emits only the processing step while the submission is in flight", () => {
    setTransactionState({ transactionHash: null });

    renderWithProviders(<TransactionProcessingScreen type={SendType.Token} />);

    expect(screenViewedProps()).toEqual([
      {
        screen_name: "send_payment_processing",
        flow: AnalyticsFlow.SEND,
        step: "processing",
      },
    ]);
  });

  it("also emits the success step once the submission settles into SENT", () => {
    setTransactionState({ transactionHash: "tx-hash" });

    renderWithProviders(<TransactionProcessingScreen type={SendType.Token} />);

    const props = screenViewedProps();
    expect(props).toContainEqual({
      screen_name: "send_payment_processing",
      flow: AnalyticsFlow.SEND,
      step: "processing",
    });
    expect(props).toContainEqual({
      screen_name: "send_payment_success",
      flow: AnalyticsFlow.SEND,
      step: "success",
    });
    // success fires exactly once
    expect(
      props.filter((p) => p.screen_name === "send_payment_success"),
    ).toHaveLength(1);
  });
});

describe("TransactionProcessingScreen status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockRecipientAddress = mockDefaultRecipientAddress;
  });

  it.each([
    ["a muxed contract (W)", MUXED_CONTRACT_ID_0],
    ["a contract (C)", BASE_CONTRACT],
  ])(
    "shows unsupported for %s when nothing is submitting and there's no result",
    (_label, recipientAddress) => {
      mockRecipientAddress = recipientAddress;
      setTransactionState({ transactionHash: null, isSubmitting: false });

      const { getByText, queryByText } = renderWithProviders(
        <TransactionProcessingScreen type={SendType.Token} />,
      );

      expect(getByText("transactionProcessingScreen.unsupported")).toBeTruthy();
      expect(
        getByText("transactionProcessingScreen.couldNotBeSentTo"),
      ).toBeTruthy();
      expect(queryByText("transactionProcessingScreen.sending")).toBeNull();
    },
  );

  it("keeps a G recipient on sending in the same state", () => {
    setTransactionState({ transactionHash: null, isSubmitting: false });

    const { getByText, queryByText } = renderWithProviders(
      <TransactionProcessingScreen type={SendType.Token} />,
    );

    expect(getByText("transactionProcessingScreen.sending")).toBeTruthy();
    expect(queryByText("transactionProcessingScreen.unsupported")).toBeNull();
  });
});
