import { renderHook } from "@testing-library/react-hooks";
import { useClearTransitionParam } from "hooks/useClearTransitionParam";

describe("useClearTransitionParam", () => {
  const createNavigation = () => {
    const unsubscribe = jest.fn();
    let registeredCallback: (() => void) | undefined;
    const addListener = jest.fn(
      (_event: "transitionEnd", callback: () => void) => {
        registeredCallback = callback;
        return unsubscribe;
      },
    );
    const setParams = jest.fn();
    return {
      navigation: { setParams, addListener },
      unsubscribe,
      triggerTransitionEnd: () => registeredCallback?.(),
    };
  };

  it("does not subscribe when transition is undefined", () => {
    const { navigation } = createNavigation();
    renderHook(() => useClearTransitionParam(navigation, undefined));
    expect(navigation.addListener).not.toHaveBeenCalled();
    expect(navigation.setParams).not.toHaveBeenCalled();
  });

  it("subscribes to transitionEnd when a transition is provided", () => {
    const { navigation } = createNavigation();
    renderHook(() => useClearTransitionParam(navigation, "fade"));
    expect(navigation.addListener).toHaveBeenCalledWith(
      "transitionEnd",
      expect.any(Function),
    );
    expect(navigation.setParams).not.toHaveBeenCalled();
  });

  it("clears the transition param when transitionEnd fires", () => {
    const { navigation, triggerTransitionEnd } = createNavigation();
    renderHook(() => useClearTransitionParam(navigation, "fade"));
    triggerTransitionEnd();
    expect(navigation.setParams).toHaveBeenCalledWith({
      transition: undefined,
    });
  });

  it("unsubscribes after firing once", () => {
    const { navigation, unsubscribe, triggerTransitionEnd } =
      createNavigation();
    renderHook(() => useClearTransitionParam(navigation, "fade"));
    triggerTransitionEnd();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes on unmount even if transitionEnd never fires", () => {
    const { navigation, unsubscribe } = createNavigation();
    const { unmount } = renderHook(() =>
      useClearTransitionParam(navigation, "fade"),
    );
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
