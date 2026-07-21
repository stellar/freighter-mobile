import { List, ListItemProps } from "components/List";
import { App } from "components/sds/App";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { TouchableOpacity, View } from "react-native";

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
  onClose: () => void;
}

const ConnectedAppsBottomSheet: React.FC<ConnectedAppsBottomSheetProps> = ({
  connectedDapps,
  discoverEnabled,
  onDisconnect,
  onGoToDiscover,
  onClose,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

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
          >
            <Icon.MinusCircle size={18} themeColor="red" />
          </TouchableOpacity>
        ),
      })),
    [connectedDapps, onDisconnect],
  );

  return (
    <View className="w-full gap-6">
      <View className="flex-row items-center justify-between">
        <Text xl medium>
          {t("connectedApps.title")}
        </Text>
        <TouchableOpacity
          onPress={onClose}
          className="size-10 items-center justify-center rounded-full bg-background-tertiary"
          testID="connected-apps-close-button"
        >
          <Icon.X color={themeColors.foreground.primary} />
        </TouchableOpacity>
      </View>

      {connectedDapps.length > 0 ? (
        <List items={listItems} variant="secondary" />
      ) : (
        <View className="w-full items-center bg-background-tertiary rounded-2xl px-4 py-6 gap-3">
          <Icon.NotificationBox
            size={24}
            color={themeColors.foreground.primary}
          />
          {discoverEnabled ? (
            <>
              <Text md primary medium textAlign="center">
                {t("connectedApps.noConnectedDappsTitle")}
              </Text>
              <Text sm secondary regular textAlign="center">
                {t("connectedApps.noConnectedDappsDescription")}
              </Text>
              <Button xl secondary onPress={onGoToDiscover}>
                {t("connectedApps.goToDiscover")}
              </Button>
            </>
          ) : (
            <Text md secondary medium textAlign="center">
              {t("connectedApps.noConnectedDappsNoDiscover")}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

export default ConnectedAppsBottomSheet;
