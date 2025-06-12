/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { SWAP_ROUTES, SwapStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";

type SwapScreenProps = NativeStackScreenProps<
  SwapStackParamList,
  typeof SWAP_ROUTES.SWAP_SCREEN
>;

const SwapScreen: React.FC<SwapScreenProps> = ({ navigation }) => {
  const { account } = useGetActiveAccount();
  const {
    network,
  } = useAuthenticationStore();
  const { themeColors } = useColors();
  const { t } = useAppTranslation();
  const [searchToken, setSearchToken] = useState("");

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation,  themeColors]);

  const handleTokenPress = (tokenId: string) => {
    console.log(tokenId);
  };

  const handleSearch = (text: string) => {
    console.log(text);
  };

  const handlePasteFromClipboard = () => {
    console.log("paste from clipboard");
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="mb-8 mt-4">
          <Input
            fieldSize="md"
            leftElement={
              <Icon.SearchMd
                size={16}
                color={themeColors.foreground.primary}
              />
            }
            testID="search-input"
            placeholder={t("swapScreen.searchTokenInputPlaceholder")}
            onChangeText={handleSearch}
            endButton={{
              content: t("common.paste"),
              onPress: handlePasteFromClipboard,
            }}
            value={searchToken}
          />
        </View>
        <BalancesList
          publicKey={account?.publicKey ?? ""}
          network={network}
          onTokenPress={handleTokenPress}
          showTitleIcon
        />
      </View>
    </BaseLayout>
  );
};

export default SwapScreen;