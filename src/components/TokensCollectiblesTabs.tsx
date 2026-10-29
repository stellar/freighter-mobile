import { BalancesList } from "components/BalancesList";
import { CollectiblesGrid } from "components/CollectiblesGrid";
import { InlineAddButton } from "components/InlineAddButton";
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
  /**
   * Press handler for the collectibles Add action: the Add Collectible
   * button in the grid's empty card (and error view) and the inline Add
   * collectible button both call it.
   */
  onAddCollectiblePress?: () => void;
  /** Press handler for the inline Add token button. */
  onAddTokenPress?: () => void;
  /**
   * End the tokens list with the inline Add token button. It also needs
   * `onAddTokenPress`, and stays off by default.
   */
  showAddTokenButton?: boolean;
  /**
   * End the collectibles grid with the inline Add collectible button. It also
   * needs `onAddCollectiblePress`, and stays off by default.
   */
  showAddCollectibleButton?: boolean;
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
 * - Optional inline Add token / Add collectible button that ends each list
 *   and scrolls with it
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
    onAddCollectiblePress,
    onAddTokenPress,
    showAddTokenButton = false,
    showAddCollectibleButton = false,
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
     * Displays the BalancesList component with the provided props, followed
     * by the inline Add token button when asked for. Figma starts the list 9pt
     * under the tab row and insets it 24pt from the sides.
     */
    const renderTokensContent = useMemo(
      () => (
        <View
          className="flex-1 pt-[9px]"
          style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
        >
          <BalancesList
            publicKey={publicKey}
            network={network}
            onTokenPress={onTokenPress}
            disableInnerScrolling={disableInnerScrolling}
            showSpendableAmount={showSpendableAmount}
            feeContext={feeContext}
            balanceRowTestIDPrefix={balanceRowTestIDPrefix}
          />
          {showAddTokenButton && onAddTokenPress ? (
            <InlineAddButton
              label={t("balancesList.addTokenButton")}
              onPress={onAddTokenPress}
              testID="home-add-token-button"
            />
          ) : null}
        </View>
      ),
      [
        publicKey,
        network,
        onTokenPress,
        showSpendableAmount,
        feeContext,
        disableInnerScrolling,
        balanceRowTestIDPrefix,
        showAddTokenButton,
        onAddTokenPress,
        t,
      ],
    );

    /**
     * Renders the collectibles content
     *
     * Figma starts the collectibles 12pt under the tab row, 3pt further than
     * the token list. Unlike the token list the grid gets the full width,
     * because CollectionSection pads its own sides; only the inline Add
     * collectible button below it, 12pt under the last collection, is inset
     * 24pt, in line with the Add token button.
     */
    const renderCollectiblesContent = useMemo(
      () => (
        <View className="flex-1 pt-[12px]">
          <CollectiblesGrid
            onCollectiblePress={onCollectiblePress}
            disableInnerScrolling={disableInnerScrolling}
            onAddCollectiblePress={onAddCollectiblePress}
          />
          {showAddCollectibleButton && onAddCollectiblePress ? (
            <View
              className="mt-[12px]"
              style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
            >
              <InlineAddButton
                label={t("collectiblesGrid.addCollectibleButton")}
                onPress={onAddCollectiblePress}
                testID="home-add-collectible-button"
              />
            </View>
          ) : null}
        </View>
      ),
      [
        onCollectiblePress,
        disableInnerScrolling,
        onAddCollectiblePress,
        showAddCollectibleButton,
        t,
      ],
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

    // Text/LG/600 labels: primary when active, Colors/Gray/9 when not
    const tabLabelColor = (tab: TabType) =>
      activeTab === tab ? themeColors.text.primary : themeColors.gray[9];

    return (
      <View className="flex-1">
        {/* The tabs sit 16pt in from the sides; each tab's contents own the
            space under the row and their own side padding. The tab classes are
            arbitrary values because NativeWind's rem is 14 here: `py-2` would
            come out at 7pt, not 8. */}
        <View
          className="flex-row items-center gap-[16px]"
          style={{ paddingHorizontal: pxValue(16) }}
        >
          <TouchableOpacity
            className="py-[8px]"
            onPress={() => handleTabChange(TabType.TOKENS)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === TabType.TOKENS }}
            testID="tab-tokens"
          >
            <Text lg semiBold color={tabLabelColor(TabType.TOKENS)}>
              {t("balancesList.title")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="py-[8px]"
            onPress={() => handleTabChange(TabType.COLLECTIBLES)}
            accessibilityRole="tab"
            accessibilityState={{
              selected: activeTab === TabType.COLLECTIBLES,
            }}
            testID="tab-collectibles"
          >
            <Text lg semiBold color={tabLabelColor(TabType.COLLECTIBLES)}>
              {t("collectiblesGrid.title")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* flex-1, so the views that fill the space they're given fill the
            screen below the row: Tokens' loading, error and empty views, and
            Collectibles' loading spinner. A populated list sizes itself to
            its rows (BalancesList, CollectiblesGrid), which leaves the inline
            Add button right under the last one rather than at the bottom of
            the screen. Collectibles' empty and error views are as tall as
            their content too. */}
        {renderContent}
      </View>
    );
  },
);

TokensCollectiblesTabs.displayName = "TokensCollectiblesTabs";
