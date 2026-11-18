import { NavigationState } from "@react-navigation/native";
import { act, renderHook } from "@testing-library/react-native";
import { useSwapStore } from "ducks/swap";
import { useNavigationAnalytics } from "hooks/useNavigationAnalytics";

const { track } = jest.requireMock("services/analytics/core");

/** The navigation state with the Swap stack open on `route`. */
const swapStackState = (
  route: { name: string; params?: object },
  stackRoutes: { name: string; params?: object }[] = [route],
) =>
  ({
    index: 0,
    routes: [
      {
        key: "swap-stack",
        name: "SwapStack",
        state: {
          index: stackRoutes.length - 1,
          routes: stackRoutes.map((stackRoute, i) => ({
            key: `swap-${i}`,
            ...stackRoute,
          })),
        },
      },
    ],
  }) as unknown as NavigationState;

// Every swap event says where the swap was opened from, its screens included.
describe("useNavigationAnalytics swap screens", () => {
  beforeEach(() => {
    track.mockClear();
    act(() => {
      useSwapStore.getState().resetSwap();
    });
  });

  it("tags swap_amount with the source the route names", () => {
    const { onStateChange } = renderHook(() => useNavigationAnalytics()).result
      .current;

    onStateChange(
      swapStackState({
        name: "SwapAmountScreen",
        params: { tokenId: "XLM", tokenSymbol: "XLM", source: "token_details" },
      }),
    );

    expect(track).toHaveBeenCalledWith("screen.viewed", {
      screen_name: "swap_amount",
      flow: "swap",
      source: "token_details",
    });
  });

  it("tags swap_amount as opened from Home when the route names no source", () => {
    const { onStateChange } = renderHook(() => useNavigationAnalytics()).result
      .current;

    onStateChange(
      swapStackState({
        name: "SwapAmountScreen",
        params: { tokenId: "XLM", tokenSymbol: "XLM" },
      }),
    );

    expect(track).toHaveBeenCalledWith("screen.viewed", {
      screen_name: "swap_amount",
      flow: "swap",
      source: "home",
    });
  });

  it("tags the token picker with the swap's source", () => {
    act(() => {
      useSwapStore.getState().setEntrySource("token_details");
    });
    const { onStateChange } = renderHook(() => useNavigationAnalytics()).result
      .current;

    onStateChange(
      swapStackState({ name: "SwapScreen", params: { selectionType: "to" } }, [
        {
          name: "SwapAmountScreen",
          params: {
            tokenId: "XLM",
            tokenSymbol: "XLM",
            source: "token_details",
          },
        },
        { name: "SwapScreen", params: { selectionType: "to" } },
      ]),
    );

    expect(track).toHaveBeenCalledWith(
      "screen.viewed",
      expect.objectContaining({ screen_name: "swap", source: "token_details" }),
    );
  });

  it("adds nothing to other screens", () => {
    const { onStateChange } = renderHook(() => useNavigationAnalytics()).result
      .current;

    onStateChange({
      index: 0,
      routes: [{ key: "home", name: "Home" }],
    } as unknown as NavigationState);

    expect(track.mock.calls[0][1]).not.toHaveProperty("source");
  });
});
