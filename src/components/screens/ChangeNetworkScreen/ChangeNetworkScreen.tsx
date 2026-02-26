/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import ChangeNetworkBottomSheetContent from "components/screens/ChangeNetworkScreen/ChangeNetworkBottomSheet";
import DeveloperBackendConfig from "components/screens/ChangeNetworkScreen/DeveloperBackendConfig";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  mapNetworkToNetworkDetails,
  NETWORK_NAMES,
  NETWORKS,
} from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { isDev } from "helpers/isEnv";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useNetworkColors from "hooks/useNetworkColors";
import React, { useMemo, useRef } from "react";
import { Pressable, View } from "react-native";

type ChangeNetworkScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.CHANGE_NETWORK_SCREEN
>;

const ChangeNetworkScreen: React.FC<ChangeNetworkScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const selectNetworkBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { network: activeNetwork, selectNetwork } = useAuthenticationStore();
  const networkColors = useNetworkColors();
  const activeNetworkDetails = useMemo(
    () => mapNetworkToNetworkDetails(activeNetwork),
    [activeNetwork],
  );

  const networkSettingsListItems = [
    {
      icon: <Icon.Globe02 size={20} color={networkColors[NETWORKS.PUBLIC]} />,
      title: NETWORK_NAMES.PUBLIC,
      onPress: () => {
        navigation.navigate(SETTINGS_ROUTES.NETWORK_SETTINGS_SCREEN, {
          selectedNetwork: NETWORKS.PUBLIC,
        });
      },
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
    },
    {
      icon: <Icon.Globe02 size={20} color={networkColors[NETWORKS.TESTNET]} />,
      title: NETWORK_NAMES.TESTNET,
      onPress: () => {
        navigation.navigate(SETTINGS_ROUTES.NETWORK_SETTINGS_SCREEN, {
          selectedNetwork: NETWORKS.TESTNET,
        });
      },
      trailingContent: (
        <Icon.ChevronRight color={themeColors.foreground.primary} />
      ),
    },
  ];

  return (
    <BaseLayout insets={{ top: false }}>
      <BottomSheet
        modalRef={selectNetworkBottomSheetModalRef}
        customContent={
          <ChangeNetworkBottomSheetContent
            activeNetwork={activeNetwork}
            networkColors={networkColors}
            onSelectNetwork={async (network) => {
              await selectNetwork(network);
              selectNetworkBottomSheetModalRef.current?.dismiss();
            }}
          />
        }
        handleCloseModal={() =>
          selectNetworkBottomSheetModalRef.current?.dismiss()
        }
      />
      <View className="flex flex-col gap-9 mt-3">
        <View className="flex flex-col">
          <Text secondary sm medium>
            {t("changeNetworkScreen.currentNetwork")}
          </Text>
          <Pressable
            className="flex flex-row items-center justify-between gap-2 px-4 py-3 rounded-lg border border-border-primary mt-2"
            onPress={() => selectNetworkBottomSheetModalRef.current?.present()}
            testID="change-network-selector"
          >
            <View className="flex flex-row items-center gap-2">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: networkColors[activeNetwork] }}
              />
              <Text primary md medium>
                {activeNetworkDetails.networkName}
              </Text>
            </View>
            <Icon.ChevronDown
              size={16}
              color={themeColors.foreground.primary}
            />
          </Pressable>
        </View>

        <View className="flex flex-col">
          <Text secondary sm medium>
            {t("changeNetworkScreen.networkSettings")}
          </Text>
          <List className="mt-5" items={networkSettingsListItems} />
        </View>

        {/* Backend configuration - only visible in dev builds */}
        {isDev && <DeveloperBackendConfig />}
      </View>
    </BaseLayout>
  );
};

export default ChangeNetworkScreen;
