import { BalancesList } from "components/BalancesList";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState, useCallback, useMemo } from "react";
import { TouchableOpacity, View } from "react-native";

export enum TabType {
  TOKENS = "tokens",
  COLLECTIBLES = "collectibles",
}

interface Props {
  defaultTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  publicKey: string;
  network: NETWORKS;
  onTokenPress?: (tokenId: string) => void;
  onCollectiblePress?: (collectibleId: string) => void;
}

/**
 * TokensCollectiblesTabs Component
 *
 * A reusable tab component for switching between Tokens and Collectibles views.
 * Used in HomeScreen and TransactionTokenScreen.
 *
 * @param {TokensCollectiblesTabsProps} props - Component props
 * @returns {JSX.Element} The tab component with content
 */
export const TokensCollectiblesTabs: React.FC<Props> = React.memo(
  ({
    defaultTab = TabType.TOKENS,
    onTabChange,
    publicKey,
    network,
    onTokenPress,
    onCollectiblePress,
  }) => {
    const { t } = useAppTranslation();
    const { themeColors } = useColors();

    const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

    const handleTabChange = useCallback(
      (tab: TabType) => {
        setActiveTab(tab);
        onTabChange?.(tab);
      },
      [onTabChange],
    );

    const renderTokensContent = useMemo(
      () => (
        <BalancesList
          publicKey={publicKey}
          network={network}
          onTokenPress={onTokenPress}
        />
      ),
      [publicKey, network, onTokenPress],
    );

    const renderCollectiblesContent = useMemo(
      () => (
        // TODO: Implement CollectiblesGrid component
        <View className="flex-1 items-center">
          <Text md secondary onPress={() => onCollectiblePress?.("")}>
            Collectibles coming soon
          </Text>
        </View>
      ),
      [onCollectiblePress],
    );

    const renderContent = useMemo(() => {
      if (activeTab === TabType.TOKENS) {
        return renderTokensContent;
      }

      return renderCollectiblesContent;
    }, [activeTab, renderTokensContent, renderCollectiblesContent]);

    return (
      <View className="flex-1">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity
            className="p-2"
            onPress={() => handleTabChange(TabType.TOKENS)}
          >
            <Text
              medium
              color={
                activeTab === TabType.TOKENS
                  ? themeColors.text.primary
                  : themeColors.text.secondary
              }
            >
              {t("balancesList.title")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="p-2"
            onPress={() => handleTabChange(TabType.COLLECTIBLES)}
          >
            <Text
              medium
              color={
                activeTab === TabType.COLLECTIBLES
                  ? themeColors.text.primary
                  : themeColors.text.secondary
              }
            >
              {t("collectiblesGrid.title")}
            </Text>
          </TouchableOpacity>
        </View>

        {renderContent}
      </View>
    );
  },
);

TokensCollectiblesTabs.displayName = "TokensCollectiblesTabs";
