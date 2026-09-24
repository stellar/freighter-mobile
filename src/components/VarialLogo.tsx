import VarialLogoSvg from "assets/logos/varial-logo.svg";
import { pxValue } from "helpers/dimensions";
import useTheme from "hooks/useTheme";
import React from "react";

const DEFAULT_LOGO_SIZE = 48;

/**
 * The Varial mark, painted in the primary color.
 *
 * The mark is a single flat color that happens to be the primary token in
 * either scheme, so it is tinted rather than shipped as one image per scheme.
 * That keeps it on the palette: a change to the primary ramp reaches the logo
 * with it, where a baked-in color would quietly fall out of step.
 */
export const VarialLogo = ({
  width = DEFAULT_LOGO_SIZE,
  height = DEFAULT_LOGO_SIZE,
}: {
  width?: number;
  height?: number;
}) => {
  const theme = useTheme();

  return (
    <VarialLogoSvg
      width={pxValue(width)}
      height={pxValue(height)}
      color={theme.colors.primary}
    />
  );
};
