/* eslint-disable react-hooks/exhaustive-deps */
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import {
  NavigationHeaderBar,
  getNavigationHeaderHeight,
} from "components/layout/CustomNavigationHeader";
import { HeaderFade } from "components/layout/HeaderFade";
import HistoryList from "components/screens/HistoryScreen/HistoryList";
import { mapNetworkToNetworkDetails } from "config/constants";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import { useFloatingTabBarClearance } from "hooks/useFloatingTabBarClearance";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import React, { useCallback, useMemo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type HistoryScreenProps = BottomTabScreenProps<
  MainTabStackParamList,
  typeof MAIN_TAB_ROUTES.TAB_HISTORY
>;

/**
 * Main History Screen component
 */
const HistoryScreen: React.FC<HistoryScreenProps> = () => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const tabBarClearance = useFloatingTabBarClearance();
  // The Activity bar floats over the list, as Discover's does, so the list
  // runs from the screen's top and starts its content below the bar: rows
  // scrolling up fade out under it, as Home's do.
  const headerHeight = getNavigationHeaderHeight(useSafeAreaInsets().top);
  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );
  const {
    historyData,
    fetchData,
    isLoading,
    error,
    isRefreshing,
    isNavigationRefresh,
  } = useGetHistoryData({
    publicKey: account?.publicKey ?? "",
    networkDetails,
    tokenId: undefined,
  });

  const handleRefresh = useCallback(() => {
    fetchData({ isRefresh: true });
  }, [fetchData]);

  return (
    <View className="flex-1 bg-base-0">
      <HistoryList
        historyData={historyData}
        isLoading={isLoading}
        error={error}
        publicKey={account?.publicKey ?? ""}
        networkDetails={networkDetails}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        isNavigationRefresh={isNavigationRefresh}
        ignoreTopInset
        topInset={headerHeight}
        refreshActionPosition="center"
        // The list runs under the floating tab bar.
        bottomClearance={tabBarClearance}
      />
      {/* After the list, so it draws on top. */}
      <View
        testID="history-header"
        style={{ position: "absolute", top: 0, left: 0, right: 0 }}
      >
        <HeaderFade />
        <NavigationHeaderBar title={t("history.title")} isTransparent />
      </View>
    </View>
  );
};

export default HistoryScreen;
