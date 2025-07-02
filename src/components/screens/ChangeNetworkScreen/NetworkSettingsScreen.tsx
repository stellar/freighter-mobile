import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import {
  FRIENDBOT_URLS,
  NETWORK_NAMES,
  NETWORK_URLS,
  mapNetworkToNetworkDetails,
} from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { isFuturenet, isTestnet } from "helpers/networks";
import useAppTranslation from "hooks/useAppTranslation";
import useNetworkColors from "hooks/useNetworkColors";
import React from "react";
import { View } from "react-native";

type NetworkSettingsScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.NETWORK_SETTINGS_SCREEN
>;

const NetworkSettingsScreen: React.FC<NetworkSettingsScreenProps> = ({
  route,
}) => {
  const { selectedNetwork } = route.params;
  const networkColors = useNetworkColors();
  const { t } = useAppTranslation();

  const isTestnetOrFuturenet =
    isTestnet(selectedNetwork) || isFuturenet(selectedNetwork);

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
      <View className="flex flex-col gap-9 mt-3">
        <View className="flex flex-col gap-[16px] bg-background-secondary rounded-[16px] p-[16px]">
          <View className="flex flex-row items-center gap-2">
            <Icon.Globe02 color={networkColors[selectedNetwork]} />
            <Text md semiBold>
              {NETWORK_NAMES[selectedNetwork]}
            </Text>
          </View>
          <Text sm secondary medium numberOfLines={1}>
            {NETWORK_URLS[selectedNetwork]}
          </Text>
        </View>

        {/* TODO: Make fields editable when we add custom network support */}
        <Input
          fieldSize="lg"
          value={NETWORK_NAMES[selectedNetwork]}
          label={t("networkSettingsScreen.networkName")}
          editable={false}
        />
        <Input
          fieldSize="lg"
          value={NETWORK_URLS[selectedNetwork]}
          label={t("networkSettingsScreen.horizonUrl")}
          editable={false}
        />
        <Input
          fieldSize="lg"
          value={mapNetworkToNetworkDetails(selectedNetwork).networkPassphrase}
          label={t("networkSettingsScreen.passphrase")}
          editable={false}
        />
        <Input
          fieldSize="lg"
          placeholder={t("networkSettingsScreen.friendbotPlaceholder")}
          value={
            isTestnetOrFuturenet
              ? FRIENDBOT_URLS[selectedNetwork as keyof typeof FRIENDBOT_URLS]
              : ""
          }
          label={t("networkSettingsScreen.friendbotUrl")}
          editable={false}
        />
      </View>
    </BaseLayout>
  );
};

export default NetworkSettingsScreen;
