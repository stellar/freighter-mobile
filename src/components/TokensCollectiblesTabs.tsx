import { BalancesList } from "components/BalancesList";
import { CollectiblesGrid } from "components/CollectiblesGrid";
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING, NETWORKS } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useState, useCallback, useMemo } from "react";
import { Platform, TouchableOpacity, View } from "react-native";

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
  /** Whether to show the collectibles settings button */
  showCollectiblesSettings?: boolean;
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
 * - Collectibles settings context menu with "Add manually" option
 * - Smart padding management for different content types
 *
 * @param {Props} props - Component props
 * @returns {JSX.Element} The tab component with content
 */
export const TokensCollectiblesTabs: React.FC<Props> = React.memo(
  ({
    defaultTab = TabType.TOKENS,
    showCollectiblesSettings = false,
    onTabChange,
    publicKey,
    network,
    onTokenPress,
    onCollectiblePress,
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
     * Context menu actions for collectibles settings
     */
    const collectiblesMenuActions: MenuItem[] = useMemo(
      () => [
        {
          title: t("collectiblesGrid.addManually"),
          systemIcon: Platform.select({
            ios: "plus.rectangle.on.rectangle",
            android: "add_box",
          }),
          disabled: true,
        },
      ],
      [t],
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
        />
      ),
      [publicKey, network, onTokenPress],
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
          <CollectiblesGrid onCollectiblePress={onCollectiblePress} />
        </View>
      ),
      [onCollectiblePress],
    );

    /**
     * Determines which content to render based on the currently active tab
     * Returns either the tokens content or collectibles content accordingly
     */
    const renderContent = useMemo(() => {
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
            className="flex-1 py-2"
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

          {/* Collectibles settings button - only visible when Collectibles tab is active */}
          {activeTab === TabType.COLLECTIBLES && showCollectiblesSettings && (
            <ContextMenuButton
              contextMenuProps={{ actions: collectiblesMenuActions }}
              side="bottom"
              align="end"
              sideOffset={8}
            >
              <View className="-mr-2">
                <Icon.Sliders01 size={20} color={themeColors.text.secondary} />
              </View>
            </ContextMenuButton>
          )}
        </View>

        {renderContent}
      </View>
    );
  },
);

TokensCollectiblesTabs.displayName = "TokensCollectiblesTabs";
