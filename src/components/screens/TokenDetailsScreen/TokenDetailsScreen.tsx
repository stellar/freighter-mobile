/* eslint-disable react/no-unstable-nested-components */
/* eslint-disable react-hooks/exhaustive-deps */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import HistoryList from "components/screens/HistoryScreen/HistoryList";
import { TokenBalanceHeader } from "components/screens/TokenDetailsScreen/components";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { mapNetworkToNetworkDetails } from "config/constants";
import {
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  SWAP_ROUTES,
  SEND_PAYMENT_ROUTES,
} from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { usePreferencesStore } from "ducks/preferences";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useGetHistoryData } from "hooks/useGetHistoryData";
import useTokenDetails from "hooks/useTokenDetails";
import React, { useCallback, useEffect, useLayoutEffect, useMemo } from "react";
import { View, Dimensions } from "react-native";

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
  const { t } = useAppTranslation();
  const { width } = Dimensions.get("window");
  const { isHideDustEnabled } = usePreferencesStore();

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

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: displayTitle,
    });
  }, [navigation, displayTitle]);

  useEffect(() => {
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
  }, [account?.publicKey, network, tokenId]);

  const handleRefresh = useCallback(() => {
    fetchData({ isRefresh: true, isHideDustEnabled });
  }, [fetchData]);

  const handleSwapPress = () => {
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.SWAP_STACK, {
      screen: SWAP_ROUTES.SWAP_AMOUNT_SCREEN,
      params: { tokenId, tokenSymbol },
    });
  };

  const handleSendPress = () => {
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.SEND_PAYMENT_STACK, {
      screen: SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN,
      params: { tokenId },
    });
  };

  return (
    <BaseLayout insets={{ top: false, bottom: false }}>
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
      <View className="mt-7 pb-3 gap-7">
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button tertiary lg isFullWidth onPress={handleSwapPress}>
              {t("tokenDetailsScreen.swap")}
            </Button>
          </View>
          <View className="flex-1">
            <Button tertiary lg isFullWidth onPress={handleSendPress}>
              {t("tokenDetailsScreen.send")}
            </Button>
          </View>
        </View>
        <View
          className="border-b mb-6 -ml-7 border-border-primary"
          style={{ width }}
        />
      </View>
    </BaseLayout>
  );
};

export default TokenDetailsScreen;
