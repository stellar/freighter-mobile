/* eslint-disable react-hooks/exhaustive-deps */
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import HistoryList from "components/screens/HistoryScreen/HistoryList";
import { mapNetworkToNetworkDetails } from "config/constants";
import { MAIN_TAB_ROUTES, MainTabStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
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
  const { isHideDustEnabled } = usePreferencesStore();
  const { historyData, fetchData, status } = useGetHistoryData(
    account?.publicKey ?? "",
    networkDetails,
  );

  useFocusEffect(
    useCallback(() => {
      const loadHistory = async () => {
        if (!account?.publicKey) {
          return;
        }

        await fetchData({
          isRefresh: false,
          isHideDustEnabled,
        });
      };

      loadHistory();
    }, [account?.publicKey, network, isHideDustEnabled]),
  );

  const handleRefresh = useCallback(() => {
    fetchData({ isRefresh: true, isHideDustEnabled });
  }, [fetchData]);

  return (
    <HistoryList
      historyData={historyData}
      status={status}
      publicKey={account?.publicKey ?? ""}
      networkDetails={networkDetails}
      onRefresh={handleRefresh}
      className="pt-5"
    />
  );
};

export default HistoryScreen;
