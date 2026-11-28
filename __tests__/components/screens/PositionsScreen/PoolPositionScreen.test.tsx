import { fireEvent } from "@testing-library/react-native";
import {
  NATIVE_SAC,
  POOL_ID,
  poolPosition,
  supplyRow,
} from "__tests__/support/positionFixtures";
import { PoolPositionScreen } from "components/screens/PositionsScreen";
import { NETWORKS } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { positionsKeyFor, usePositionsStore } from "ducks/positions";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("hooks/useGetActiveAccount", () => ({
  __esModule: true,
  default: () => ({ account: { publicKey: "GACCOUNT" } }),
}));

// Refreshing runs on focus, which needs a navigator.
jest.mock(
  "components/screens/PositionsScreen/hooks/usePositionsRefresh",
  () => ({ usePositionsRefresh: jest.fn() }),
);

const mockTrackRowSelected = jest.fn();
jest.mock("services/analytics/positions", () => ({
  trackPositionsRowSelected: (...args: unknown[]) =>
    mockTrackRowSelected(...args),
}));

const mockTrackPoolDetailsOpened = jest.fn();
jest.mock("services/analytics/earn", () => ({
  trackEarnPoolDetailsOpened: (...args: unknown[]) =>
    mockTrackPoolDetailsOpened(...args),
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
      source: "pool-route",
      target: "root-stack",
    }),
  );

const renderScreen = () =>
  renderWithProviders(
    <PoolPositionScreen
      navigation={navigation as never}
      route={{ key: "pool-route", params: { poolId: POOL_ID } } as never}
    />,
  );

const setPositions = (
  positions = [poolPosition()],
  { hasLoaded = true } = {},
) =>
  usePositionsStore.setState({
    fetchedKey: positionsKeyFor("GACCOUNT", NETWORKS.PUBLIC),
    positions,
    hasLoaded,
  });

describe("PoolPositionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePositionsStore.getState().reset();
    useAuthenticationStore.setState({ network: NETWORKS.PUBLIC });
    useRemoteConfigStore.setState({
      isInitialized: true,
      positions_enabled: true,
    });
  });

  it("shows the pool's total, its gain on principal and each supplied token", () => {
    setPositions();

    const { getByTestId, getByText } = renderScreen();

    expect(getByText("Blend")).toBeTruthy();
    expect(getByTestId("pool-position-name")).toHaveTextContent(
      "Fixed v2.1 Pool",
    );
    expect(getByTestId("pool-position-total")).toHaveTextContent("$800.12");
    expect(getByTestId("pool-position-gain")).toHaveTextContent(
      "+$0.12 (0.02%)",
    );
    expect(getByTestId("position-row-USDC-subtitle")).toHaveTextContent(
      "16.94% APY",
    );
    expect(getByTestId("position-row-USDC-value")).toHaveTextContent("$500.12");
    expect(getByTestId("position-row-USDC-amount")).toHaveTextContent(
      "500.1223 USDC",
    );
  });

  it("names native XLM as the wallet does", () => {
    setPositions([
      poolPosition({
        supply: [
          supplyRow({
            assetId: NATIVE_SAC,
            symbol: null,
            name: null,
            decimals: null,
            totalTokens: "15001223000",
          }),
        ],
      }),
    ]);

    const { getByText, getByTestId } = renderScreen();

    expect(getByText("Stellar Lumens")).toBeTruthy();
    expect(getByTestId("position-row-XLM-amount")).toHaveTextContent(
      "1,500.1223 XLM",
    );
  });

  it("opens a token's position, reporting the row and the pool details it shows", () => {
    setPositions();

    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId("position-row-USDC"));

    expect(mockTrackRowSelected).toHaveBeenCalledWith({
      poolId: POOL_ID,
      protocol: "blend",
      assetCode: "USDC",
    });
    expect(mockTrackPoolDetailsOpened).toHaveBeenCalledWith({
      poolId: POOL_ID,
      source: "position_row",
    });
    expect(navigation.navigate).toHaveBeenCalledWith(
      ROOT_NAVIGATOR_ROUTES.TOKEN_POSITION_SCREEN,
      {
        poolId: POOL_ID,
        assetId: poolPosition().supply![0].assetId,
        tokenCode: "USDC",
      },
    );
  });

  it("closes when a refresh drops the pool", () => {
    setPositions([]);

    renderScreen();

    closedItself();
  });

  it("closes when Positions go away", () => {
    setPositions();
    useRemoteConfigStore.setState({ positions_enabled: false });

    renderScreen();

    closedItself();
  });

  it("stays open while this account's positions haven't loaded", () => {
    setPositions([], { hasLoaded: false });

    renderScreen();

    expect(navigation.dispatch).not.toHaveBeenCalled();
  });
});
