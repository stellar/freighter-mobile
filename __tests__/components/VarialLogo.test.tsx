import { render } from "@testing-library/react-native";
import { VarialLogo } from "components/VarialLogo";
import { getTheme } from "config/theme";
import React from "react";

describe("VarialLogo", () => {
  it("paints the mark with the theme's primary color", () => {
    // The mark is one flat color, and that color is the primary token in both
    // schemes. Tinting it beats shipping a PNG per scheme: the logo stays on
    // the palette, so a change to the primary ramp reaches the logo with it.
    // Jest reports no device scheme, so this resolves DEFAULT_COLOR_SCHEME.
    const { getByTestId } = render(<VarialLogo />);

    expect(getByTestId("SvgMock").props.color).toBe(
      getTheme("light").colors.primary,
    );
  });
});
