import { BalancesList } from "components/BalancesList";
import { CollectiblesGrid } from "components/CollectiblesGrid";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_PADDING,
  NETWORKS,
  TransactionContext,
} from "config/constants";
import { pxValue } from "helpers/dimensions";
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
  onCollectiblePress?: ({
    collectionAddress,
    tokenId,
  }: {
    collectionAddress: string;
    tokenId: string;
  }) => void;
  /** Whether to show spendable amounts instead of total amounts for tokens */
  showSpendableAmount?: boolean;
  /** Type of fee to use for spendable amount calculation */
  feeContext?: TransactionContext;
  /** Whether to disable inner scrolling for both the tokens and collectibles grids */
  disableInnerScrolling?: boolean;
  /** Optional testID prefix forwarded to each balance row (e.g. "token-option" → "token-option-XLM") */
  balanceRowTestIDPrefix?: string;
}

/**
 * TokensCollectiblesTabs Component
 *
 * A reusable tab component for switching between Tokens and Collectibles views.
 * Used in HomeScreen to provide consistent navigation
 * between different asset types.
 *
 * Features:
 * - Tab switching between Tokens and Collectibles
 * - Collectibles tab only shown for PUBLIC network
 * - Memoized content rendering for performance
 * - Dynamic tab styling based on active state
 * - Callback support for tab changes and item interactions
 * - Smart padding management for different content types
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
    showSpendableAmount = false,
    feeContext = TransactionContext.Send,
    disableInnerScrolling = false,
    balanceRowTestIDPrefix,
  }) => {
    const { t } = useAppTranslation();
    const { themeColors } = useColors();

    const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

    /**
     * Handles tab switching and triggers the optional onTabChange callback
     * @param {TabType} tab - The tab type to switch to
     */
    const handleTabChange = useCallback(
      (tab: TabType) => {
        setActiveTab(tab);
        onTabChange?.(tab);
      },
      [onTabChange],
    );

    /**
     * Renders the tokens/balances list content
     * Displays the BalancesList component with the provided props
     */
    const renderTokensContent = useMemo(
      () => (
        <BalancesList
          publicKey={publicKey}
          network={network}
          onTokenPress={onTokenPress}
          disableInnerScrolling={disableInnerScrolling}
          showSpendableAmount={showSpendableAmount}
          feeContext={feeContext}
          balanceRowTestIDPrefix={balanceRowTestIDPrefix}
        />
      ),
      [
        publicKey,
        network,
        onTokenPress,
        showSpendableAmount,
        feeContext,
        disableInnerScrolling,
        balanceRowTestIDPrefix,
      ],
    );

    /**
     * Renders the collectibles content with custom padding management
     *
     * Note: This component uses a padding workaround to ensure the collectibles grid
     * extends to the full screen width while maintaining proper spacing for other content.
     * The negative horizontal margin counteracts the parent container's padding,
     * allowing the CollectiblesGrid to render edge-to-edge as intended.
     */
    const renderCollectiblesContent = useMemo(
      () => (
        <View
          className="flex-1"
          style={{ marginHorizontal: -pxValue(DEFAULT_PADDING) }}
        >
          <CollectiblesGrid
            onCollectiblePress={onCollectiblePress}
            disableInnerScrolling={disableInnerScrolling}
          />
        </View>
      ),
      [onCollectiblePress, disableInnerScrolling],
    );

    /**
     * Determines which content to render based on the currently active tab
     * Returns either the tokens content or collectibles content accordingly
     */
    const renderContent = useMemo(() => {
      // If collectibles are hidden, we should render tokens content only
      if (activeTab === TabType.TOKENS) {
        return renderTokensContent;
      }

      return renderCollectiblesContent;
    }, [activeTab, renderTokensContent, renderCollectiblesContent]);

    return (
      <View
        className="flex-1"
        style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
      >
        <View className="flex-row items-center gap-1 mb-6">
          <TouchableOpacity
            className={`px-3 py-2 border-b-2 ${
              activeTab === TabType.TOKENS
                ? "border-lilac-9"
                : "border-transparent"
            }`}
            onPress={() => handleTabChange(TabType.TOKENS)}
            testID="tab-tokens"
          >
            <Text
              weight={activeTab === TabType.TOKENS ? "medium" : "semiBold"}
              color={
                activeTab === TabType.TOKENS
                  ? themeColors.lilac[11]
                  : themeColors.text.secondary
              }
            >
              {t("balancesList.title")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`px-3 py-2 border-b-2 ${
              activeTab === TabType.COLLECTIBLES
                ? "border-lilac-9"
                : "border-transparent"
            }`}
            onPress={() => handleTabChange(TabType.COLLECTIBLES)}
            testID="tab-collectibles"
          >
            <Text
              weight={
                activeTab === TabType.COLLECTIBLES ? "medium" : "semiBold"
              }
              color={
                activeTab === TabType.COLLECTIBLES
                  ? themeColors.lilac[11]
                  : themeColors.text.secondary
              }
            >
              {t("collectiblesGrid.title")}
            </Text>
          </TouchableOpacity>

          <View className="flex-1" />
        </View>

        {renderContent}
      </View>
    );
  },
);

TokensCollectiblesTabs.displayName = "TokensCollectiblesTabs";
