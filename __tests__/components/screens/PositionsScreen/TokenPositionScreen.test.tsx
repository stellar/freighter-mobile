import { fireEvent } from "@testing-library/react-native";
import {
  OTHER_POOL_ID,
  POOL_ID,
  USDC_ISSUER,
  USDC_SAC,
  catalogPool,
  catalogReserve,
  poolPosition,
  supplyRow,
} from "__tests__/support/positionFixtures";
import BigNumber from "bignumber.js";
import { TokenPositionScreen } from "components/screens/PositionsScreen";
import { NETWORKS } from "config/constants";
import { EARN_ROUTES, ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useBalancesStore } from "ducks/balances";
import { useEarnStore } from "ducks/earn";
import { positionsKeyFor, usePositionsStore } from "ducks/positions";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: { publicKey: "GACCOUNT", subentryCount: 1 } }),
}));

// Refreshing runs on focus, which needs a navigator.
jest.mock(
  "components/screens/PositionsScreen/hooks/usePositionsRefresh",
  () => ({ usePositionsRefresh: jest.fn() }),
);

const mockTrackTabSelected = jest.fn();
jest.mock("services/analytics/positions", () => ({
  trackEarnPoolDetailsTabSelected: (...args: unknown[]) =>
    mockTrackTabSelected(...args),
  trackPositionsActivityRowSelected: jest.fn(),
  trackPositionsActivityDetailsAction: jest.fn(),
}));

const navigation = {
  navigate: jest.fn(),
  dispatch: jest.fn(),
  getState: () => ({ key: "root-stack" }),
  setOptions: jest.fn(),
};

/** This screen closing itself, wherever it is in the stack. */
const closedItself = () =>
  expect(navigation.dispatch).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "GO_BACK",
      source: "token-route",
      target: "root-stack",
    }),
  );

const renderScreen = (poolId = POOL_ID) =>
  renderWithProviders(
    <TokenPositionScreen
      navigation={navigation as never}
      route={
        {
          key: "token-route",
          params: { poolId, assetId: USDC_SAC, tokenCode: "USDC" },
        } as never
      }
    />,
  );

const setPositions = (positions = [poolPosition()]) =>
  usePositionsStore.setState({
    fetchedKey: positionsKeyFor("GACCOUNT", NETWORKS.PUBLIC),
    positions,
    hasLoaded: true,
  });

const usdcBalance = (amount: number) => ({
  [`USDC:${USDC_ISSUER}`]: {
    token: {
      code: "USDC",
      issuer: { key: USDC_ISSUER },
      type: "credit_alphanum4",
    },
    total: new BigNumber(amount),
    available: new BigNumber(amount),
    currentPrice: new BigNumber(1),
  },
});

describe("TokenPositionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePositionsStore.getState().reset();
    useEarnStore.getState().resetEarn();
    useAuthenticationStore.setState({ network: NETWORKS.PUBLIC });
    useRemoteConfigStore.setState({
      isInitialized: true,
      positions_enabled: true,
      earn_deposit: true,
    });
    useBalancesStore.setState({ pricedBalances: usdcBalance(25) as never });
    usePositionsStore.setState({
      pools: [catalogPool()],
      poolsNetwork: NETWORKS.PUBLIC,
    });
    setPositions();
  });

  describe("Your position", () => {
    it("shows the balance and its gain, then deposits as principal and earnings as interest", () => {
      const { getByTestId } = renderScreen();

      expect(getByTestId("token-position-total")).toHaveTextContent("$500.12");
      expect(getByTestId("token-position-gain")).toHaveTextContent(
        "+$0.12 (0.02%)",
      );
      // 500.1223 held, 0.1234 of it interest.
      expect(getByTestId("token-position-deposits-value")).toHaveTextContent(
        "$500.00",
      );
      expect(getByTestId("token-position-deposits-amount")).toHaveTextContent(
        "499.9989 USDC",
      );
      expect(
        getByTestId("token-position-earnings-line-value"),
      ).toHaveTextContent("+$0.12");
      expect(
        getByTestId("token-position-earnings-line-amount"),
      ).toHaveTextContent("0.1234 USDC");
      expect(
        getByTestId("token-position-earnings-line-subtitle"),
      ).toHaveTextContent("16.94% Deposit APY");
    });

    it("estimates earnings on the whole balance", () => {
      const { getByTestId } = renderScreen();

      // $500.12 at 16.94%: $84.72 a year, a twelfth of it a month.
      expect(getByTestId("token-position-est-yearly")).toHaveTextContent(
        "$84.72",
      );
      expect(getByTestId("token-position-est-monthly")).toHaveTextContent(
        "$7.06",
      );
    });

    it("reads unknown figures as --, never as zero", () => {
      setPositions([
        poolPosition({
          supply: [
            supplyRow({ usdValue: null, interestEarnedUsd: null, apy: null }),
          ],
        }),
      ]);

      const { getByTestId } = renderScreen();

      expect(getByTestId("token-position-total")).toHaveTextContent("--");
      expect(getByTestId("token-position-gain")).toHaveTextContent("--");
      expect(getByTestId("token-position-est-yearly")).toHaveTextContent("--");
    });
  });

  describe("tabs", () => {
    it("shows the pool's Overview, reporting the change", () => {
      const { getByTestId, getByText } = renderScreen();

      fireEvent.press(getByTestId("position-tabs-overview"));

      expect(getByTestId("token-position-overview")).toBeTruthy();
      expect(
        getByText(/Deposit supported tokens into Blend's Fixed v2.1 Pool/),
      ).toBeTruthy();
      expect(mockTrackTabSelected).toHaveBeenCalledWith({
        poolId: POOL_ID,
        tab: "overview",
      });
    });

    it("reports nothing for a tap on the tab already open", () => {
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("position-tabs-your_position"));

      expect(mockTrackTabSelected).not.toHaveBeenCalled();
    });
  });

  describe("Deposit", () => {
    it("prefills Earn with the token and its pool, opening on the amount screen", () => {
      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("token-position-deposit"));

      const earn = useEarnStore.getState();
      expect(earn.pool?.id).toBe(POOL_ID);
      expect(earn.selectedAssetId).toBe(USDC_SAC);
      expect(earn.selectedAssetCode).toBe("USDC");
      expect(earn.selectedAssetApy).toBe(0.1694);
      expect(earn.selectedAssetDecimals).toBe(7);
      expect(earn.source).toBe("position_row");
      // The picker mounted under the amount screen skips the intro.
      expect(earn.isPrefilledEntry).toBe(true);
      expect(navigation.navigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.EARN_STACK,
        {
          screen: EARN_ROUTES.EARN_AMOUNT_SCREEN,
          params: { assetId: USDC_SAC, tokenCode: "USDC" },
          initial: false,
        },
      );
    });

    it("opens the token picker when the wallet holds none of the token", () => {
      useBalancesStore.setState({ pricedBalances: usdcBalance(0) as never });

      const { getByTestId } = renderScreen();

      fireEvent.press(getByTestId("token-position-deposit"));

      expect(useEarnStore.getState().source).toBe("position_row");
      // Opening on the picker is a visit like any other.
      expect(useEarnStore.getState().isPrefilledEntry).toBe(false);
      expect(navigation.navigate).toHaveBeenCalledWith(
        ROOT_NAVIGATOR_ROUTES.EARN_STACK,
        { screen: EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN },
      );
    });

    it("isn't offered while deposits are off", () => {
      useRemoteConfigStore.setState({ earn_deposit: false });

      const { queryByTestId } = renderScreen();

      expect(queryByTestId("token-position-deposit")).toBeNull();
    });

    it("isn't offered for a pool Earn doesn't offer", () => {
      setPositions([poolPosition({ poolId: OTHER_POOL_ID })]);
      usePositionsStore.setState({
        pools: [catalogPool({ id: OTHER_POOL_ID })],
      });

      const { queryByTestId } = renderScreen(OTHER_POOL_ID);

      expect(queryByTestId("token-position-deposit")).toBeNull();
    });

    it("isn't offered for a reserve the pool has turned off", () => {
      usePositionsStore.setState({
        pools: [
          catalogPool({ reserves: [catalogReserve({ enabled: false })] }),
        ],
      });

      const { queryByTestId } = renderScreen();

      expect(queryByTestId("token-position-deposit")).toBeNull();
    });

    it("waits for this network's pool catalog", () => {
      usePositionsStore.setState({ poolsNetwork: NETWORKS.TESTNET });

      const { queryByTestId } = renderScreen();

      expect(queryByTestId("token-position-deposit")).toBeNull();
    });
  });

  describe("closing", () => {
    it("closes when a refresh drains the token", () => {
      setPositions([poolPosition({ supply: [] })]);

      renderScreen();

      closedItself();
    });

    // The pool screen under it closes itself too.
    it("closes when a refresh drops its pool", () => {
      setPositions([]);

      renderScreen();

      closedItself();
    });

    it("closes when Positions go away", () => {
      useRemoteConfigStore.setState({ positions_enabled: false });

      renderScreen();

      closedItself();
    });

    it("stays open while the token is there", () => {
      renderScreen();

      expect(navigation.dispatch).not.toHaveBeenCalled();
    });
  });
});
