import { waitFor } from "@testing-library/react-native";
import TokenStatsSection from "components/screens/TokenDetailsScreen/components/PriceHistory/TokenStatsSection";
import { NETWORKS } from "config/constants";
import { TokenStats } from "config/types";
import {
  usePriceHistoryStore,
  resetInFlightRequests,
} from "ducks/priceHistory";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";
import { fetchTokenStats } from "services/backend";

jest.mock("services/backend", () => ({
  fetchTokenPriceHistory: jest.fn(),
  fetchTokenStats: jest.fn(),
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFetchStats = fetchTokenStats as jest.MockedFunction<
  typeof fetchTokenStats
>;

const renderSection = (
  props: Partial<React.ComponentProps<typeof TokenStatsSection>> = {},
) =>
  renderWithProviders(
    <TokenStatsSection tokenId="native" network={NETWORKS.PUBLIC} {...props} />,
  );

describe("TokenStatsSection", () => {
  beforeEach(() => {
    resetInFlightRequests();
    jest.clearAllMocks();
    useRemoteConfigStore.setState({
      isInitialized: true,
      use_token_price_history: true,
    });
    usePriceHistoryStore.setState({
      historyByNetwork: {},
      statsByNetwork: {},
      historyStatusByKey: {},
    });
  });

  it("renders only the rows present in the payload", async () => {
    mockFetchStats.mockResolvedValue({
      token: "native",
      supplyOnStellar: "105443902087.3472865",
      holders: 9926520,
    } as TokenStats);

    const { getByText } = renderSection();

    await waitFor(() => {
      expect(getByText("Token Stats")).toBeTruthy();
    });
    expect(getByText("Supply on Stellar")).toBeTruthy();
    expect(getByText("105,443,902,087")).toBeTruthy();
    expect(getByText("Holders")).toBeTruthy();
    expect(getByText("9,926,520")).toBeTruthy();
  });

  it("omits absent fields instead of rendering empty rows", async () => {
    mockFetchStats.mockResolvedValue({
      token: "native",
      holders: 42,
    } as TokenStats);

    const { getByText, queryByText } = renderSection();

    await waitFor(() => {
      expect(getByText("Holders")).toBeTruthy();
    });
    expect(queryByText("Supply on Stellar")).toBeNull();
  });

  it("hides the whole section when no rows are returned", async () => {
    mockFetchStats.mockResolvedValue({ token: "native" } as TokenStats);

    const { queryByText } = renderSection();

    await waitFor(() => {
      expect(mockFetchStats).toHaveBeenCalled();
    });
    expect(queryByText("Token Stats")).toBeNull();
  });

  it("hides the section (and never fetches) off mainnet", () => {
    const { queryByText } = renderSection({ network: NETWORKS.TESTNET });

    expect(queryByText("Token Stats")).toBeNull();
    expect(mockFetchStats).not.toHaveBeenCalled();
  });

  it("hides the section (and never fetches) when the kill switch is off", () => {
    useRemoteConfigStore.setState({
      isInitialized: true,
      use_token_price_history: false,
    });

    const { queryByText } = renderSection();

    expect(queryByText("Token Stats")).toBeNull();
    expect(mockFetchStats).not.toHaveBeenCalled();
  });

  it("hides the section on a failed fetch rather than an empty card", async () => {
    mockFetchStats.mockRejectedValue(new Error("boom"));

    const { queryByText } = renderSection();

    await waitFor(() => {
      expect(mockFetchStats).toHaveBeenCalled();
    });
    expect(queryByText("Token Stats")).toBeNull();
  });
});
