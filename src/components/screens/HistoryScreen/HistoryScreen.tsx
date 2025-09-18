/* eslint-disable react-hooks/exhaustive-deps */
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import HistoryList from "components/screens/HistoryScreen/HistoryList";
import { mapNetworkToNetworkDetails } from "config/constants";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import React, { useCallback, useMemo } from "react";

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
    <HistoryList
      historyData={historyData}
      isLoading={isLoading}
      error={error}
      publicKey={account?.publicKey ?? ""}
      networkDetails={networkDetails}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      isNavigationRefresh={isNavigationRefresh}
      className="pt-5"
    />
  );
};

export default HistoryScreen;
