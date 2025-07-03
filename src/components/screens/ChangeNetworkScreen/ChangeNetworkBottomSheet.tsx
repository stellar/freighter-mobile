import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NETWORKS, DEFAULT_NETWORKS } from "config/constants";
import useColors from "hooks/useColors";
import React, { Fragment } from "react";
import { TouchableOpacity, View } from "react-native";

type ChangeNetworkBottomSheetContentProps = {
  activeNetwork: NETWORKS;
  networkColors: Record<string, string>;
  onSelectNetwork: (network: NETWORKS) => Promise<void>;
};

const ChangeNetworkBottomSheetContent: React.FC<
  ChangeNetworkBottomSheetContentProps
> = ({ activeNetwork, networkColors, onSelectNetwork }) => {
  const { themeColors } = useColors();

  return DEFAULT_NETWORKS.map((network, index) => (
    <Fragment key={network.network}>
      <TouchableOpacity
        className="flex flex-row items-center justify-between px-3 py-2"
        onPress={() => {
          onSelectNetwork(network.network);
        }}
      >
        <View className="flex flex-row items-center gap-2">
          <Icon.Globe02 color={networkColors[network.network]} />
          <Text primary md medium>
            {network.networkName}
          </Text>
        </View>
        <Icon.Check
          color={
            activeNetwork === network.network
              ? themeColors.base[1]
              : "transparent"
          }
        />
      </TouchableOpacity>
      {index !== DEFAULT_NETWORKS.length - 1 && (
        <View className="h-px bg-border-primary" />
      )}
    </Fragment>
  ));
};

export default ChangeNetworkBottomSheetContent;
