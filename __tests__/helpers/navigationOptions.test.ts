import { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { ScreenTransition } from "config/routes";
import { withTransitionOverride } from "helpers/navigationOptions";

describe("withTransitionOverride", () => {
  const baseOptions: NativeStackNavigationOptions = {
    animation: "slide_from_bottom",
    animationDuration: 300,
    animationTypeForReplace: "push",
  };

  it("returns the base options unchanged when the route has no params", () => {
    const result = withTransitionOverride(baseOptions, {});
    expect(result).toBe(baseOptions);
  });

  it("returns the base options unchanged when transition is undefined", () => {
    const result = withTransitionOverride(baseOptions, {
      params: { transition: undefined },
    });
    expect(result).toBe(baseOptions);
  });

  it("overrides animation when transition is provided", () => {
    const result = withTransitionOverride(baseOptions, {
      params: { transition: ScreenTransition.Fade },
    });
    expect(result.animation).toBe(ScreenTransition.Fade);
  });

  it("preserves other base options when overriding animation", () => {
    const result = withTransitionOverride(baseOptions, {
      params: { transition: ScreenTransition.Fade },
    });
    expect(result.animationDuration).toBe(300);
    expect(result.animationTypeForReplace).toBe("push");
  });

  it("does not mutate the base options object", () => {
    const snapshot = { ...baseOptions };
    withTransitionOverride(baseOptions, {
      params: { transition: ScreenTransition.Fade },
    });
    expect(baseOptions).toEqual(snapshot);
  });
});
