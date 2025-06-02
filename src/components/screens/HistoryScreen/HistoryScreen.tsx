/* eslint-disable react-hooks/exhaustive-deps */
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import HistoryList from "components/screens/HistoryScreen/HistoryList";
import { mapNetworkToNetworkDetails } from "config/constants";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import React, { useCallback, useEffect, useMemo } from "react";

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
  const { historyData, fetchData, status } = useGetHistoryData(
    account?.publicKey ?? "",
    networkDetails,
  );

  useEffect(() => {
    const loadHistory = async () => {
      if (!account?.publicKey) {
        return;
      }

      await fetchData({
        isRefresh: false,
      });
    };

    loadHistory();
  }, [account?.publicKey, network]);

  const handleRefresh = useCallback(() => {
    fetchData({ isRefresh: true });
  }, [fetchData]);

  return (
    <HistoryList
      historyData={historyData}
      status={status}
      publicKey={account?.publicKey ?? ""}
      networkDetails={networkDetails}
      onRefresh={handleRefresh}
    />
  );
};

export default HistoryScreen;
