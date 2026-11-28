import { fireEvent } from "@testing-library/react-native";
import {
  POOL_ID,
  USDC_SAC,
  poolPosition,
} from "__tests__/support/positionFixtures";
import { PositionActivityList } from "components/screens/PositionsScreen/components/PositionActivityList";
import {
  PositionActivityItem,
  PositionActivityType,
} from "components/screens/PositionsScreen/helpers/positionActivity";
import { toPositionTokenRows } from "components/screens/PositionsScreen/helpers/positionRows";
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const networkDetails = mapNetworkToNetworkDetails(NETWORKS.PUBLIC);
const [row] = toPositionTokenRows({ position: poolPosition(), networkDetails });

let mockItems: PositionActivityItem[] | null = null;
jest.mock(
  "components/screens/PositionsScreen/hooks/usePositionActivity",
  () => ({ usePositionActivity: () => mockItems }),
);

// The sheet's content renders in place, as if presented.
jest.mock("components/BottomSheet", () => ({
  __esModule: true,
  default: ({ customContent }: { customContent: React.ReactNode }) =>
    customContent,
}));

// The receipt reads the date and fee off the network.
jest.mock("services/stellar", () => ({
  getTransactionDetails: jest.fn(() => Promise.resolve(null)),
}));

const mockTrackRowSelected = jest.fn();
const mockTrackDetailsAction = jest.fn();
jest.mock("services/analytics/positions", () => ({
  trackPositionsActivityRowSelected: (...args: unknown[]) =>
    mockTrackRowSelected(...args),
  trackPositionsActivityDetailsAction: (...args: unknown[]) =>
    mockTrackDetailsAction(...args),
}));

const mockOpenInAppBrowser = jest.fn(() => Promise.resolve());
jest.mock("hooks/useInAppBrowser", () => ({
  useInAppBrowser: () => ({ open: mockOpenInAppBrowser }),
}));

const item = (
  overrides: Partial<PositionActivityItem> = {},
): PositionActivityItem => ({
  id: "op-1:0",
  protocol: "blend",
  positionId: POOL_ID,
  assetId: USDC_SAC,
  type: PositionActivityType.DEPOSIT,
  amount: "5000000000",
  occurredAt: "2026-08-28T12:00:00Z",
  txHash: "a".repeat(64),
  envelopeXdr: "",
  ...overrides,
});

const renderList = () =>
  renderWithProviders(
    <PositionActivityList
      row={row}
      publicKey="GACCOUNT"
      networkDetails={networkDetails}
    />,
  );

describe("PositionActivityList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockItems = null;
  });

  it("renders nothing until there is something to list", () => {
    mockItems = [];

    const { queryByTestId } = renderList();

    expect(queryByTestId("position-activity")).toBeNull();
  });

  it("signs deposits in and withdrawals out, with their dates", () => {
    mockItems = [
      item(),
      item({
        id: "op-2:0",
        type: PositionActivityType.WITHDRAW,
        amount: "502300000",
        occurredAt: "2025-08-07T12:00:00Z",
      }),
    ];

    const { getAllByTestId, getByText } = renderList();

    const amounts = getAllByTestId("position-activity-amount");
    expect(amounts[0]).toHaveTextContent("+500.00 USDC");
    expect(amounts[1]).toHaveTextContent("-50.23 USDC");
    expect(getByText("Withdraw")).toBeTruthy();
    expect(getByText("Aug 7, 2025")).toBeTruthy();
  });

  it("reads a withdrawal of unknown size as --", () => {
    mockItems = [item({ type: PositionActivityType.WITHDRAW, amount: null })];

    const { getByTestId } = renderList();

    expect(getByTestId("position-activity-amount")).toHaveTextContent("--");
  });

  it("opens a withdrawal's record, unsigned, reporting the row and its actions", () => {
    mockItems = [
      item({
        type: PositionActivityType.WITHDRAW,
        amount: "502300000",
      }),
    ];

    const { getByTestId, getByText } = renderList();
    fireEvent.press(getByTestId("position-activity-row"));

    const eventProps = {
      poolId: POOL_ID,
      protocol: "blend",
      assetCode: "USDC",
      activityType: "withdraw",
    };
    expect(mockTrackRowSelected).toHaveBeenCalledWith(eventProps);
    expect(getByText("Withdrew USDC")).toBeTruthy();
    expect(getByText("From")).toBeTruthy();
    expect(getByTestId("earn-withdraw-details-amount")).toHaveTextContent(
      "50.23 USDC",
    );

    fireEvent.press(getByTestId("earn-withdraw-details-view-on-explorer"));

    expect(mockTrackDetailsAction).toHaveBeenCalledWith({
      ...eventProps,
      action: "explorer",
    });
    expect(mockOpenInAppBrowser).toHaveBeenCalledWith(
      expect.stringContaining(`/tx/${"a".repeat(64)}`),
    );
  });
});
