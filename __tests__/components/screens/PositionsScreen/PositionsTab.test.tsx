import { fireEvent } from "@testing-library/react-native";
import {
  POOL_ID,
  USDC_SAC,
  poolPosition,
  supplyRow,
} from "__tests__/support/positionFixtures";
import BigNumber from "bignumber.js";
import { PositionsTab } from "components/screens/PositionsScreen/components/PositionsTab";
import { NETWORKS } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { positionsKeyFor, usePositionsStore } from "ducks/positions";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const PUBLIC_KEY = "GACCOUNT";

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: { publicKey: "GACCOUNT" } }),
}));

const props = () => ({
  canDeposit: true,
  onPoolPress: jest.fn(),
  onDepositPress: jest.fn(),
  onStartEarningPress: jest.fn(),
});

/** The store as a successful read for this account leaves it. */
const loaded = (positions = [poolPosition()]) =>
  usePositionsStore.setState({
    fetchedKey: positionsKeyFor(PUBLIC_KEY, NETWORKS.PUBLIC),
    positions,
    hasLoaded: true,
    isLoading: false,
    error: null,
  });

describe("PositionsTab", () => {
  beforeEach(() => {
    usePositionsStore.getState().reset();
    useAuthenticationStore.setState({ network: NETWORKS.PUBLIC });
    useBalancesStore.setState({ pricedBalances: {} });
  });

  it("spins until this account's positions have loaded", () => {
    const { getByTestId } = renderWithProviders(<PositionsTab {...props()} />);

    expect(getByTestId("positions-tab-spinner")).toBeTruthy();
  });

  it("never shows another account's positions while this one's load", () => {
    usePositionsStore.setState({
      fetchedKey: positionsKeyFor("GOTHER", NETWORKS.PUBLIC),
      positions: [poolPosition()],
      hasLoaded: true,
    });

    const { getByTestId, queryByTestId } = renderWithProviders(
      <PositionsTab {...props()} />,
    );

    expect(getByTestId("positions-tab-spinner")).toBeTruthy();
    expect(queryByTestId(`pool-card-${POOL_ID}`)).toBeNull();
  });

  it("says the positions couldn't load, never that there are none", () => {
    usePositionsStore.setState({
      fetchedKey: positionsKeyFor(PUBLIC_KEY, NETWORKS.PUBLIC),
      hasLoaded: false,
      error: "Network Error",
    });

    const { getByText, queryByTestId } = renderWithProviders(
      <PositionsTab {...props()} />,
    );

    expect(getByText("Failed to fetch your positions.")).toBeTruthy();
    expect(queryByTestId("positions-empty-state")).toBeNull();
  });

  describe("with positions", () => {
    it("shows each pool's name, total, gain and net APY", () => {
      loaded();

      const { getByTestId, getByText } = renderWithProviders(
        <PositionsTab {...props()} />,
      );

      expect(getByText(/Fixed v2.1 Pool/)).toBeTruthy();
      expect(getByTestId(`pool-card-value-${POOL_ID}`)).toHaveTextContent(
        "$800.12",
      );
      // $0.12 of interest on $500.00 of principal.
      expect(getByTestId(`pool-card-gain-${POOL_ID}`)).toHaveTextContent(
        "+0.02%",
      );
      expect(getByTestId(`pool-card-apy-${POOL_ID}`)).toHaveTextContent(
        "11.32% Net APY",
      );
    });

    it("reads an unknown gain and rate as --, never as zero", () => {
      loaded([
        poolPosition({
          netApy: null,
          supply: [supplyRow({ interestEarnedUsd: null })],
        }),
      ]);

      const { getByTestId } = renderWithProviders(
        <PositionsTab {...props()} />,
      );

      expect(getByTestId(`pool-card-gain-${POOL_ID}`)).toHaveTextContent("--");
      expect(getByTestId(`pool-card-apy-${POOL_ID}`)).toHaveTextContent(
        "-- Net APY",
      );
    });

    it("opens a pool from its card", () => {
      loaded();
      const tabProps = props();

      const { getByTestId } = renderWithProviders(
        <PositionsTab {...tabProps} />,
      );
      fireEvent.press(getByTestId(`pool-card-${POOL_ID}`));

      expect(tabProps.onPoolPress).toHaveBeenCalledWith(
        expect.objectContaining({ poolId: POOL_ID }),
      );
    });

    it("ends the list with Deposit where deposits are offered", () => {
      loaded();
      const tabProps = props();

      const { getByTestId } = renderWithProviders(
        <PositionsTab {...tabProps} />,
      );
      fireEvent.press(getByTestId("positions-deposit-button"));

      expect(tabProps.onDepositPress).toHaveBeenCalled();
    });

    it("offers no Deposit while deposits are off", () => {
      loaded();

      const { queryByTestId } = renderWithProviders(
        <PositionsTab {...props()} canDeposit={false} />,
      );

      expect(queryByTestId("positions-deposit-button")).toBeNull();
    });
  });

  describe("with nothing supplied", () => {
    it("projects a year of earnings on the tokens the wallet holds", () => {
      loaded([]);
      usePositionsStore.setState({
        earnOptions: [
          {
            assetId: USDC_SAC,
            symbol: "USDC",
            name: null,
            decimals: 7,
            pools: [
              {
                id: POOL_ID,
                name: "Fixed v2.1",
                supplyApy: 0.1,
                emissionsSupplyApr: null,
                suppliedUsd: null,
              },
            ],
          },
        ],
        earnOptionsNetwork: NETWORKS.PUBLIC,
      });
      useBalancesStore.setState({
        pricedBalances: {
          "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN": {
            token: {
              code: "USDC",
              issuer: {
                key: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
              },
              type: "credit_alphanum4",
            },
            total: new BigNumber(500),
            available: new BigNumber(500),
            currentPrice: new BigNumber(1),
          },
        } as never,
      });

      const { getByTestId } = renderWithProviders(
        <PositionsTab {...props()} />,
      );

      // 500 USDC at 10% a year.
      expect(
        getByTestId("positions-empty-projection-figure"),
      ).toHaveTextContent("$50.00 /");
    });

    it("falls back to the best rate on offer when the wallet holds none of it", () => {
      loaded([]);
      usePositionsStore.setState({
        earnOptions: [
          {
            assetId: USDC_SAC,
            symbol: "USDC",
            name: null,
            decimals: 7,
            pools: [
              {
                id: POOL_ID,
                name: "Fixed v2.1",
                supplyApy: 0.1694,
                emissionsSupplyApr: null,
                suppliedUsd: null,
              },
            ],
          },
        ],
        earnOptionsNetwork: NETWORKS.PUBLIC,
      });

      const { getByTestId } = renderWithProviders(
        <PositionsTab {...props()} />,
      );

      expect(
        getByTestId("positions-empty-projection-figure"),
      ).toHaveTextContent("16.94% /");
    });

    it("leaves the projection out without the catalog", () => {
      loaded([]);

      const { getByTestId, queryByTestId } = renderWithProviders(
        <PositionsTab {...props()} />,
      );

      expect(getByTestId("positions-empty-state")).toBeTruthy();
      expect(queryByTestId("positions-empty-projection")).toBeNull();
    });

    it("ignores another network's catalog", () => {
      loaded([]);
      usePositionsStore.setState({
        earnOptions: [
          {
            assetId: USDC_SAC,
            symbol: "USDC",
            name: null,
            decimals: 7,
            pools: [
              {
                id: POOL_ID,
                name: null,
                supplyApy: 0.1,
                emissionsSupplyApr: null,
                suppliedUsd: null,
              },
            ],
          },
        ],
        earnOptionsNetwork: NETWORKS.TESTNET,
      });

      const { queryByTestId } = renderWithProviders(
        <PositionsTab {...props()} />,
      );

      expect(queryByTestId("positions-empty-projection")).toBeNull();
    });

    it("starts Earn from the card where deposits are offered", () => {
      loaded([]);
      const tabProps = props();

      const { getByTestId } = renderWithProviders(
        <PositionsTab {...tabProps} />,
      );
      fireEvent.press(getByTestId("positions-start-earning-button"));

      expect(tabProps.onStartEarningPress).toHaveBeenCalled();
    });

    it("keeps the card, without its button, while deposits are off", () => {
      loaded([]);

      const { getByTestId, queryByTestId } = renderWithProviders(
        <PositionsTab {...props()} canDeposit={false} />,
      );

      expect(getByTestId("positions-empty-state")).toBeTruthy();
      expect(queryByTestId("positions-start-earning-button")).toBeNull();
    });
  });
});
