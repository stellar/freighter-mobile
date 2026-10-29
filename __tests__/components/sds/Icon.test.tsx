/* eslint-disable @typescript-eslint/naming-convention */
import XSvg from "assets/icons/x.svg";
import Icon from "components/sds/Icon";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

describe("Icon strokeWidth", () => {
  it("converts a stroke in points to the SVG's 24-unit grid", () => {
    // 2pt on a 32pt icon is 1.5 units of the 24-unit grid.
    const { getByTestId } = renderWithProviders(
      <Icon.X size={32} strokeWidth={2} />,
    );

    expect(getByTestId("SvgMock").props.strokeWidth).toBe(1.5);
  });

  it("passes a stroke through unchanged at the grid's own size", () => {
    const { getByTestId } = renderWithProviders(<Icon.X strokeWidth={2} />);

    expect(getByTestId("SvgMock").props.strokeWidth).toBe(2);
  });

  it("hands the SVG no stroke width when none is given, so it keeps its own", () => {
    // svgr spreads props after the file's own attributes, so an explicit
    // undefined would replace the root's width and draw the glyph at SVG's
    // default of 1.
    const { UNSAFE_getByType } = renderWithProviders(<Icon.X size={32} />);

    expect("strokeWidth" in UNSAFE_getByType(XSvg).props).toBe(false);
  });
});
