import {
  getFloatingTabBarClearance,
  getFloatingTabBarTop,
} from "components/FloatingTabBar/geometry";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * How far above the screen's bottom edge a tab screen's content must end to
 * clear the floating tab bar. The bar reports the same value to React
 * Navigation, which `useBottomTabBarHeight()` returns.
 */
export const useFloatingTabBarClearance = (): number =>
  getFloatingTabBarClearance(useSafeAreaInsets().bottom);

/**
 * The floating tab bar's top edge, measured up from the screen's bottom edge.
 * Discover's search bar and tab overview footer rest here, their own padding
 * the gap above the pill.
 */
export const useFloatingTabBarTop = (): number =>
  getFloatingTabBarTop(useSafeAreaInsets().bottom);
