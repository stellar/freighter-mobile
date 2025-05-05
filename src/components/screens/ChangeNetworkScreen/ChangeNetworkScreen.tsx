/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { BaseLayout } from "components/layout/BaseLayout";
import ChangeNetworkBottomSheetContent from "components/screens/ChangeNetworkScreen/ChangeNetworkBottomSheet";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { mapNetworkToNetworkDetails, NETWORKS } from "config/constants";
import { SETTINGS_ROUTES, SettingsStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo, useRef } from "react";
import { Pressable, View } from "react-native";

type ChangeNetworkScreenProps = NativeStackScreenProps<
  SettingsStackParamList,
  typeof SETTINGS_ROUTES.CHANGE_NETWORK_SCREEN
>;

const ChangeNetworkScreen: React.FC<ChangeNetworkScreenProps> = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const selectNetworkBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { network: activeNetwork, selectNetwork } = useAuthenticationStore();
  const activeNetworkDetails = useMemo(
    () => mapNetworkToNetworkDetails(activeNetwork),
    [activeNetwork],
  );

  const networkColors = {
    [NETWORKS.TESTNET]: themeColors.pink[9],
    [NETWORKS.PUBLIC]: themeColors.lime[9],
    [NETWORKS.FUTURENET]: themeColors.mint[9],
  };

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
      <View className="flex flex-col mt-3">
        <Text secondary sm medium>
          {t("changeNetworkScreen.currentNetwork")}
        </Text>
        <Pressable
          className="flex flex-row items-center justify-between gap-2 px-4 py-3 rounded-lg border border-border-primary mt-2"
          onPress={() => selectNetworkBottomSheetModalRef.current?.present()}
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
          <Icon.ChevronDown size={16} color={themeColors.foreground.primary} />
        </Pressable>
      </View>
    </BaseLayout>
  );
};

export default ChangeNetworkScreen;
