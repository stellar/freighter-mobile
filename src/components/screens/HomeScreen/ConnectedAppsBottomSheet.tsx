import { List, ListItemProps } from "components/List";
import { App } from "components/sds/App";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface ConnectedDapp {
  topic: string;
  name: string;
  favicon?: string;
}

interface ConnectedAppsBottomSheetProps {
  connectedDapps: ConnectedDapp[];
  discoverEnabled: boolean;
  onDisconnect: (topic: string) => void;
  onGoToDiscover: () => void;
}

const ConnectedAppsBottomSheet: React.FC<ConnectedAppsBottomSheetProps> = ({
  connectedDapps,
  discoverEnabled,
  onDisconnect,
  onGoToDiscover,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const insets = useSafeAreaInsets();

  const listItems = useMemo<ListItemProps[]>(
    () =>
      connectedDapps.map((dapp) => ({
        key: dapp.topic,
        icon: <App appName={dapp.name} favicon={dapp.favicon} />,
        title: dapp.name,
        trailingContent: (
          <TouchableOpacity
            onPress={() => onDisconnect(dapp.topic)}
            className="w-10 h-10 items-end justify-center pr-1"
            testID={`disconnect-${dapp.topic}`}
            accessibilityRole="button"
            accessibilityLabel={t("connectedApps.disconnectApp", {
              appName: dapp.name,
            })}
          >
            <Icon.MinusCircle size={18} themeColor="red" />
          </TouchableOpacity>
        ),
      })),
    [connectedDapps, onDisconnect, t],
  );

  return connectedDapps.length > 0 ? (
    <List items={listItems} variant="secondary" />
  ) : (
    <View
      className="w-full items-center px-4 pt-6 gap-4"
      style={{
        paddingBottom: insets.bottom + pxValue(DEFAULT_PADDING * 2),
      }}
    >
      <View className="size-16 items-center justify-center rounded-full bg-background-tertiary">
        <Icon.NotificationBox
          size={24}
          color={themeColors.foreground.primary}
        />
      </View>
      {discoverEnabled ? (
        <>
          <Text lg primary medium textAlign="center">
            {t("connectedApps.noConnectedDappsTitle")}
          </Text>
          <Text sm secondary regular textAlign="center">
            {t("connectedApps.noConnectedDappsDescription")}
          </Text>
          <View className="mt-3">
            <Button xl tertiary onPress={onGoToDiscover}>
              {t("connectedApps.goToDiscover")}
            </Button>
          </View>
        </>
      ) : (
        <Text lg secondary medium textAlign="center">
          {t("connectedApps.noConnectedDappsNoDiscover")}
        </Text>
      )}
    </View>
  );
};

export default ConnectedAppsBottomSheet;
