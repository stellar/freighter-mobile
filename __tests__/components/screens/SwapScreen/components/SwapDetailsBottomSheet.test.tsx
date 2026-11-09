import { fireEvent, within } from "@testing-library/react-native";
import { SwapDetailsBottomSheet } from "components/screens/SwapScreen/components/SwapDetailsBottomSheet";
import { buildSwapRouteView } from "components/screens/SwapScreen/helpers/swapRouteView";
import { DiscoverProtocol, SwapRoute } from "config/types";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

const USDC = "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const EURC = "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2";

const PROTOCOLS: DiscoverProtocol[] = [
  {
    name: "Aquarius",
    iconUrl: "https://icons.example/aquarius.png",
    description: "",
    websiteUrl: "https://aqua.network",
    tags: [],
    isTrending: false,
  },
];

const splitRoute: SwapRoute = {
  source: "lifi",
  fromAmount: "100",
  toAmount: "37",
  paths: [
    {
      share: "0.68",
      hops: [
        { venue: "Aquarius", from: "XLM", to: EURC, pool: "p1" },
        { venue: "Soroswap", from: EURC, to: USDC, pool: "p2" },
      ],
    },
    {
      share: "0.32",
      hops: [{ venue: "Aquarius", from: "XLM", to: USDC, pool: "p3" }],
    },
  ],
  fees: [],
};

const classicRoute: SwapRoute = {
  source: "classic",
  fromAmount: "100",
  toAmount: "37",
  paths: [
    { share: "1", hops: [{ venue: "stellar-dex", from: "XLM", to: USDC }] },
  ],
  fees: [],
};

const view = (route: SwapRoute) =>
  buildSwapRouteView({ route, protocols: PROTOCOLS, balanceItems: [] });

const renderSheet = (route: SwapRoute | null, onClose = jest.fn()) =>
  renderWithProviders(
    <SwapDetailsBottomSheet
      networkFee="0.00001 XLM"
      rate="1 XLM ≈ 0.37 USDC"
      routeView={route ? view(route) : null}
      onClose={onClose}
    />,
  );

describe("SwapDetailsBottomSheet", () => {
  it("opens the route from Details and returns with the back arrow", () => {
    const { getByTestId, getByText, queryByTestId } = renderSheet(splitRoute);

    expect(getByText("Details")).toBeTruthy();
    expect(getByText("2 providers")).toBeTruthy();

    fireEvent.press(getByTestId("swap-details-route-row"));

    expect(getByTestId("swap-route-sheet")).toBeTruthy();
    expect(queryByTestId("swap-details-sheet")).toBeNull();
    expect(getByText("Split across 2 paths")).toBeTruthy();
    expect(getByText("68%")).toBeTruthy();
    expect(getByText("32%")).toBeTruthy();
    expect(getByText("2 pools")).toBeTruthy();
    expect(getByText("1 pool")).toBeTruthy();

    fireEvent.press(getByTestId("swap-route-back"));

    expect(getByTestId("swap-details-sheet")).toBeTruthy();
    expect(queryByTestId("swap-route-sheet")).toBeNull();
  });

  it("closes from the route with the X", () => {
    const onClose = jest.fn();
    const { getByTestId } = renderSheet(splitRoute, onClose);

    fireEvent.press(getByTestId("swap-details-route-row"));
    fireEvent.press(getByTestId("swap-route-close"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("expands a path into its tokens and venues, without amounts", () => {
    const { getByTestId, queryByTestId, getAllByText } =
      renderSheet(splitRoute);
    fireEvent.press(getByTestId("swap-details-route-row"));

    expect(queryByTestId("swap-route-path-0-steps")).toBeNull();
    fireEvent.press(getByTestId("swap-route-path-0"));

    const steps = within(getByTestId("swap-route-path-0-steps"));
    expect(steps.getByText("XLM")).toBeTruthy();
    expect(steps.getByText("EURC")).toBeTruthy();
    expect(steps.getByText("USDC")).toBeTruthy();
    expect(steps.getByText("Aquarius")).toBeTruthy();
    // Soroswap is in the chips and the expanded path.
    expect(getAllByText("Soroswap")).toHaveLength(2);
  });

  it("gives an unlisted venue the generic icon", () => {
    const { getByTestId, getAllByTestId } = renderSheet(splitRoute);
    fireEvent.press(getByTestId("swap-details-route-row"));

    const providers = getAllByTestId("swap-route-provider");
    expect(providers).toHaveLength(2);
    expect(within(providers[0]).getByText("Aquarius")).toBeTruthy();
    expect(within(providers[0]).getByTestId("swap-venue-icon")).toBeTruthy();
    expect(within(providers[1]).getByText("Soroswap")).toBeTruthy();
    expect(
      within(providers[1]).getByTestId("swap-venue-icon-generic"),
    ).toBeTruthy();
  });

  it("classic stand-in: one path, no share pill, no pool count", () => {
    const { getByTestId, getByText, queryByText, queryByTestId } =
      renderSheet(classicRoute);

    expect(getByText("1 provider")).toBeTruthy();
    fireEvent.press(getByTestId("swap-details-route-row"));

    expect(getByText("1 path")).toBeTruthy();
    expect(queryByText("100%")).toBeNull();
    expect(queryByTestId("swap-route-path-0-pools")).toBeNull();
  });

  it("hides the Route row without a route", () => {
    const { getByTestId, queryByTestId } = renderSheet(null);

    expect(getByTestId("swap-details-sheet")).toBeTruthy();
    expect(queryByTestId("swap-details-route-row")).toBeNull();
  });
});
