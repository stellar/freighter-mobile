import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { NativeToken, AssetToken, PricedBalance } from "config/types";
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
  balance: PricedBalance | undefined,
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
  navigation: NativeStackNavigationProp<
    SwapStackParamList,
    keyof SwapStackParamList
  >,
  swapFee: string,
  swapTimeout: number,
  swapSlippage: number,
  routes: typeof SWAP_ROUTES,
) => [
  {
    title: t("swapScreen.menu.fee", { fee: swapFee }),
    systemIcon: "divide.circle",
    onPress: () => {
      navigation.navigate(routes.SWAP_FEE_SCREEN);
    },
  },
  {
    title: t("swapScreen.menu.timeout", {
      timeout: swapTimeout,
    }),
    systemIcon: "clock",
    onPress: () => {
      navigation.navigate(routes.SWAP_TIMEOUT_SCREEN);
    },
  },
  {
    title: t("swapScreen.menu.slippage", {
      slippage: swapSlippage,
    }),
    systemIcon: "plusminus.circle",
    onPress: () => {
      navigation.navigate(routes.SWAP_SLIPPAGE_SCREEN);
    },
  },
];
