import SusdeLogo from "assets/logos/susde.svg";
import UsdeLogo from "assets/logos/usde.svg";
import { PALETTE } from "config/theme";
import React from "react";
import { SvgProps } from "react-native-svg";

export const ETHENA_DOCS_URL = "https://docs.ethena.fi/";

/**
 * The promo is the same black page with light text in both themes, so its
 * colors come from the dark palette whatever the device's scheme is.
 */
export const ETHENA_LAUNCH_COLORS = {
  page: PALETTE.dark.base["00"],
  textPrimary: PALETTE.dark.gray[12],
  textSecondary: PALETTE.dark.gray[11],
  icon: PALETTE.dark.gray["09"],
} as const;

/**
 * The Home banner that opens the promo looks the same in both themes too. Dark
 * mode adds an outline so the card stands out on the black page.
 */
export const ETHENA_LAUNCH_BANNER_COLORS = {
  background: "#070908",
  title: PALETTE.dark.base["01"],
  subtitle: PALETTE.dark.gray[10],
  dismiss: PALETTE.dark.gray[10],
  darkModeOutline: PALETTE.dark.gray["04"],
} as const;

export interface EthenaLaunchToken {
  id: "usde" | "susde";
  code: "USDe" | "sUSDe";
  /** Sushi's Stellar swap, from XLM (token0) to this token (token1). */
  swapUrl: string;
  Logo: React.FC<SvgProps>;
}

export const ETHENA_LAUNCH_TOKENS: readonly EthenaLaunchToken[] = [
  {
    id: "usde",
    code: "USDe",
    swapUrl:
      "https://www.sushi.com/stellar/swap?token0=CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA&token1=CCNOV6XVI2O5BSTA3232GIRUQULDEBV7IWGKM6QKI6II5OIIQTU24JJN",
    Logo: UsdeLogo,
  },
  {
    id: "susde",
    code: "sUSDe",
    swapUrl:
      "https://www.sushi.com/stellar/swap?token0=CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA&token1=CACSKWC753QVGC4J6YPDBIR2BEHFVWIAE7CBSS3HOVYMN623OAIQYE2M",
    Logo: SusdeLogo,
  },
];
