/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react-hooks/exhaustive-deps */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import HistoryList from "components/screens/HistoryScreen/HistoryList";
import { TokenBalanceHeader } from "components/screens/TokenDetailsScreen/components";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { mapNetworkToNetworkDetails } from "config/constants";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import useTokenDetails from "hooks/useTokenDetails";
import React, { useCallback, useEffect, useMemo } from "react";
import { TouchableOpacity, View } from "react-native";

type TokenDetailsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.TOKEN_DETAILS_SCREEN
>;

/**
 * Token Details Screen component showing transaction history for a specific token
 */
const TokenDetailsScreen: React.FC<TokenDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const { tokenId, tokenSymbol } = route.params;
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  const { actualTokenDetails, displayTitle } = useTokenDetails({
    tokenId,
    tokenSymbol,
    publicKey: account?.publicKey,
    network,
  });

  const networkDetails = useMemo(
    () => mapNetworkToNetworkDetails(network),
    [network],
  );

  const { historyData, fetchData, status } = useGetHistoryData(
    account?.publicKey ?? "",
    networkDetails,
    tokenId,
  );

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
      headerTitle: displayTitle,
    });
  }, [navigation, themeColors, displayTitle]);

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
  }, [account?.publicKey, network, tokenId]);

  const handleRefresh = useCallback(() => {
    fetchData({ isRefresh: true });
  }, [fetchData]);

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 gap-8 mt-5">
        <TokenBalanceHeader
          tokenId={tokenId}
          tokenSymbol={tokenSymbol}
          actualTokenSymbol={actualTokenDetails?.symbol}
          tokenName={actualTokenDetails?.name}
        />

        <HistoryList
          ignoreTopInset
          noHorizontalPadding
          historyData={historyData}
          status={status}
          publicKey={account?.publicKey ?? ""}
          networkDetails={networkDetails}
          onRefresh={handleRefresh}
          ListHeaderComponent={
            <View className="mb-6">
              <Text md medium secondary>
                {t("tokenDetailsScreen.listHeader", {
                  tokenName: displayTitle,
                })}
              </Text>
            </View>
          }
        />
      </View>
    </BaseLayout>
  );
};

export default TokenDetailsScreen;
