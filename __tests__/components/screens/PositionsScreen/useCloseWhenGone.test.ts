import {
  ParamListBase,
  StackNavigationState,
  StackRouter,
} from "@react-navigation/native";
import { renderHook } from "@testing-library/react-native";
import { useCloseWhenGone } from "components/screens/PositionsScreen/hooks/useCloseWhenGone";

const STACK_KEY = "root-stack";

/** Home, a pool's position, and a token's over it. */
const stack = (): StackNavigationState<ParamListBase> => ({
  key: STACK_KEY,
  index: 2,
  routeNames: ["Home", "PoolPositionScreen", "TokenPositionScreen"],
  routes: [
    { key: "home", name: "Home" },
    { key: "pool", name: "PoolPositionScreen" },
    { key: "token", name: "TokenPositionScreen" },
  ],
  type: "stack",
  stale: false,
  preloadedRoutes: [],
});

const navigationFor = () => ({
  dispatch: jest.fn(),
  getState: () => ({ key: STACK_KEY }),
});

/** What the stack becomes after the action the hook dispatched. */
const stackAfter = (navigation: ReturnType<typeof navigationFor>) => {
  const router = StackRouter({});
  const action = navigation.dispatch.mock.calls[0][0];
  return router.getStateForAction(stack(), action, {
    routeNames: stack().routeNames,
    routeParamList: {},
    routeGetIdList: {},
  });
};

describe("useCloseWhenGone", () => {
  it("does nothing while the screen's content is there", () => {
    const navigation = navigationFor();

    renderHook(() =>
      useCloseWhenGone({ isGone: false, navigation, routeKey: "pool" }),
    );

    expect(navigation.dispatch).not.toHaveBeenCalled();
  });

  // A refresh can drop the pool while its token's screen is over it, and a
  // plain goBack() would pop the token's screen instead.
  it("closes the calling screen even when another screen is over it", () => {
    const navigation = navigationFor();

    renderHook(() =>
      useCloseWhenGone({ isGone: true, navigation, routeKey: "pool" }),
    );

    expect(stackAfter(navigation)?.routes.map((route) => route.key)).toEqual([
      "home",
      "token",
    ]);
  });

  it("closes the screen on top as goBack() would", () => {
    const navigation = navigationFor();

    renderHook(() =>
      useCloseWhenGone({ isGone: true, navigation, routeKey: "token" }),
    );

    expect(stackAfter(navigation)?.routes.map((route) => route.key)).toEqual([
      "home",
      "pool",
    ]);
  });
});
