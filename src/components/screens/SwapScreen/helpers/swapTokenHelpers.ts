import { NativeToken, AssetToken , PricedBalance } from "config/types";
import { t } from "i18next";

/**
 * Creates a fallback token when balance doesn't contain token information
 */
export const createFallbackToken = (): NativeToken => ({
  type: "native",
  code: "XLM",
});

/**
 * Extracts token from balance or creates fallback
 */
export const getTokenFromBalance = (
  balance: PricedBalance | undefined
): NativeToken | AssetToken => {
  if (balance && "token" in balance) {
    return balance.token;
  }
  return createFallbackToken();
};

/**
 * Creates menu actions for swap settings
 */
export const createSwapMenuActions = (
  navigation: any,
  swapFee: string,
  swapTimeout: number,
  swapSlippage: number,
  SWAP_ROUTES: any
) => [
  {
    title: t("swapScreen.menu.fee", { fee: swapFee }),
    systemIcon: "divide.circle",
    onPress: () => {
      navigation.navigate(SWAP_ROUTES.SWAP_FEE_SCREEN);
    },
  },
  {
    title: t("swapScreen.menu.timeout", {
      timeout: swapTimeout,
    }),
    systemIcon: "clock",
    onPress: () => {
      navigation.navigate(SWAP_ROUTES.SWAP_TIMEOUT_SCREEN);
    },
  },
  {
    title: t("swapScreen.menu.slippage", {
      slippage: swapSlippage,
    }),
    systemIcon: "plusminus.circle",
    onPress: () => {
      navigation.navigate(SWAP_ROUTES.SWAP_SLIPPAGE_SCREEN);
    },
  },
]; 