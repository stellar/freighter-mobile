import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  ADD_FUNDS_ROUTES,
  AddFundsStackParamList,
  ROOT_NAVIGATOR_ROUTES,
} from "config/routes";
import { useRemoteConfigStore } from "ducks/remoteConfig";
import useAppTranslation from "hooks/useAppTranslation";
import { useCoinbaseOnramp } from "hooks/useCoinbaseOnramp";
import React, { useCallback } from "react";
import { TouchableOpacity, View } from "react-native";

type AddFundsScreenProps = NativeStackScreenProps<
  AddFundsStackParamList,
  typeof ADD_FUNDS_ROUTES.ADD_FUNDS_SCREEN
>;

const AddFundsScreen: React.FC<AddFundsScreenProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { isUnfunded } = route.params;
  const { openCoinbaseUrl, isLoading } = useCoinbaseOnramp({
    ...(isUnfunded ? { token: "XLM" } : {}),
  });
  const { onramp_enabled: onRampEnabled } = useRemoteConfigStore();

  const onCoinbasePress = useCallback(() => {
    openCoinbaseUrl();
  }, [openCoinbaseUrl]);

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1 justify-start align-start pt-5">
        {onRampEnabled && (
          <View className="items-center mt-5 w-full">
            <TouchableOpacity
              className={`bg-background-tertiary rounded-2xl p-5 w-full gap-[12px] ${isLoading ? "opacity-50" : ""}`}
              onPress={onCoinbasePress}
              disabled={isLoading}
            >
              <Icon.CoinbaseLogo size={36} />
              <View>
                <Text md medium>
                  {t("addFundsScreen.buyWithCoinbase.title")}
                </Text>
                <Text sm secondary medium>
                  {t("addFundsScreen.buyWithCoinbase.description")}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        <View className="items-center mt-5 w-full">
          <TouchableOpacity
            className="bg-background-tertiary rounded-2xl p-5 w-full gap-[12px]"
            onPress={() =>
              navigation.navigate(ROOT_NAVIGATOR_ROUTES.SCAN_RECEIVE_SCREEN, {
                initialTab: "receive",
              })
            }
          >
            <Icon.QrCode01
              themeColor={isUnfunded ? "lilac" : "mint"}
              size={20}
              withBackground
            />
            <View>
              <Text md medium>
                {t("addFundsScreen.transferFromAnotherAccount.title")}
              </Text>
              <Text sm secondary medium>
                {t("addFundsScreen.transferFromAnotherAccount.description")}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </BaseLayout>
  );
};

export default AddFundsScreen;
