import { BalancesList } from "components/BalancesList";
import { CollectiblesGrid } from "components/CollectiblesGrid";
import { Text } from "components/sds/Typography";
import { NETWORKS } from "config/constants";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState, useCallback, useMemo } from "react";
import { TouchableOpacity, View } from "react-native";

/**
 * Available tab types for the TokensCollectiblesTabs component
 */
export enum TabType {
  /** Display tokens/balances list */
  TOKENS = "tokens",
  /** Display collectibles grid */
  COLLECTIBLES = "collectibles",
}

/**
 * Props for the TokensCollectiblesTabs component
 */
interface Props {
  /** The default active tab when the component mounts */
  defaultTab?: TabType;
  /** Callback function triggered when tab changes */
  onTabChange?: (tab: TabType) => void;
  /** The public key of the wallet to display data for */
  publicKey: string;
  /** The network to fetch data from */
  network: NETWORKS;
  /** Callback function when a token is pressed */
  onTokenPress?: (tokenId: string) => void;
  /** Callback function when a collectible is pressed */
  onCollectiblePress?: (collectibleId: string) => void;
}

/**
 * TokensCollectiblesTabs Component
 *
 * A reusable tab component for switching between Tokens and Collectibles views.
 * Used in HomeScreen and TransactionTokenScreen to provide consistent navigation
 * between different asset types.
 *
 * Features:
 * - Tab switching between Tokens and Collectibles
 * - Memoized content rendering for performance
 * - Dynamic tab styling based on active state
 * - Callback support for tab changes and item interactions
 *
 * @param {Props} props - Component props
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
      () => <CollectiblesGrid onCollectiblePress={onCollectiblePress} />,
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
        <View className="flex-row items-center gap-3 mb-4">
          <TouchableOpacity
            className="py-2"
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
            className="py-2"
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
