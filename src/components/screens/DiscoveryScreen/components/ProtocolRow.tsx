import { App } from "components/sds/App";
import { Button } from "components/sds/Button";
import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View, TouchableOpacity } from "react-native";

interface ProtocolRowProps {
  name: string;
  subtitle?: string;
  iconUrl: string;
  onOpen: () => void;
  onPress: () => void;
}

const ProtocolRow: React.FC<ProtocolRowProps> = React.memo(
  ({ name, subtitle, iconUrl, onOpen, onPress }) => {
    const { t } = useAppTranslation();

    return (
      <View className="flex-row items-center">
        <TouchableOpacity
          className="flex-row items-center flex-1 mr-3"
          onPress={onPress}
          delayPressIn={DEFAULT_PRESS_DELAY}
        >
          <App appName={name} favicon={iconUrl} size="lg" />
          <View className="ml-4 flex-1">
            <Text md medium numberOfLines={1}>
              {name}
            </Text>
            {subtitle && (
              <Text sm secondary numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <Button secondary lg onPress={onOpen}>
          {t("discovery.open")}
        </Button>
      </View>
    );
  },
);

ProtocolRow.displayName = "ProtocolRow";

export default ProtocolRow;
