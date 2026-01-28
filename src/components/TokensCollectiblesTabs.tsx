import { NavigationProp, useNavigation } from "@react-navigation/native";
import { BalancesList } from "components/BalancesList";
import { CollectiblesGrid } from "components/CollectiblesGrid";
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import {
  DEFAULT_PADDING,
  NETWORKS,
  TransactionContext,
} from "config/constants";
import {
  MANAGE_TOKENS_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { useCollectiblesStore } from "ducks/collectibles";
import { isIOS } from "helpers/device";
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
  /** Whether to hide the collectibles tab */
  hideCollectibles?: boolean;
  /** Whether to show the settings menu button for tokens tab */
  showTokensSettings?: boolean;
  /** Whether to show the settings menu button for collectibles tab */
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
 * - Collectibles tab only shown for PUBLIC network
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
    hideCollectibles = false,
    showTokensSettings = true,
    showCollectiblesSettings = true,
    onTabChange,
    publicKey,
    network,
    onTokenPress,
    onCollectiblePress,
    showSpendableAmount = false,
    feeContext = TransactionContext.Send,
    disableInnerScrolling = false,
  }) => {
    const navigation = useNavigation<NavigationProp<RootStackParamList>>();
    const { t } = useAppTranslation();
    const { themeColors } = useColors();

    const isCollectiblesLoading = useCollectiblesStore(
      (state) => state.isLoading,
    );

    const [activeTab, setActiveTab] = useState<TabType>(defaultTab);

    const shouldHideCollectibles = useMemo(
      () => hideCollectibles || network !== NETWORKS.PUBLIC,
      [hideCollectibles, network],
    );

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
     * Context menu actions for tokens settings
     */
    const tokensMenuActions: MenuItem[] = useMemo(() => {
      const actions = [
        {
          title: t("balancesList.menuManageTokens"),
          systemIcon: Platform.select({
            ios: "pencil",
            android: "edit",
          }),
          onPress: () =>
            navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_TOKENS_STACK, {
              screen: MANAGE_TOKENS_ROUTES.MANAGE_TOKENS_SCREEN,
            }),
        },
        {
          title: t("balancesList.menuAddToken"),
          systemIcon: Platform.select({
            ios: "plus.circle",
            android: "add_circle",
          }),
          onPress: () =>
            navigation.navigate(ROOT_NAVIGATOR_ROUTES.MANAGE_TOKENS_STACK, {
              screen: MANAGE_TOKENS_ROUTES.ADD_TOKEN_SCREEN,
            }),
        },
      ];

      // Reverse the array for iOS to match Android behavior
      return isIOS ? actions.reverse() : actions;
    }, [t, navigation]);

    /**
     * Context menu actions for collectibles settings
     */
    const collectiblesMenuActions: MenuItem[] = useMemo(() => {
      const actions = [
        {
          title: t("collectiblesGrid.menuAddManually"),
          systemIcon: Platform.select({
            ios: "plus.rectangle.on.rectangle",
            android: "add_box",
          }),
          disabled: isCollectiblesLoading,
          onPress: () =>
            navigation.navigate(ROOT_NAVIGATOR_ROUTES.ADD_COLLECTIBLE_SCREEN),
        },
        {
          title: t("collectiblesGrid.menuHidenCollectibles"),
          systemIcon: Platform.select({
            ios: "eye.slash",
            android: "visibility_off",
          }),
          onPress: () =>
            navigation.navigate(
              ROOT_NAVIGATOR_ROUTES.HIDDEN_COLLECTIBLES_SCREEN,
            ),
        },
      ];

      // Reverse the array for iOS to match Android behavior
      return isIOS ? actions.reverse() : actions;
    }, [t, navigation, isCollectiblesLoading]);

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
        />
      ),
      [
        publicKey,
        network,
        onTokenPress,
        showSpendableAmount,
        feeContext,
        disableInnerScrolling,
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
      if (shouldHideCollectibles || activeTab === TabType.TOKENS) {
        return renderTokensContent;
      }

      return renderCollectiblesContent;
    }, [
      shouldHideCollectibles,
      activeTab,
      renderTokensContent,
      renderCollectiblesContent,
    ]);

    /**
     * Determines whether to show the settings menu button based on active tab
     */
    const showSettingsMenu = useMemo(() => {
      if (activeTab === TabType.TOKENS) {
        return showTokensSettings;
      }
      return showCollectiblesSettings;
    }, [activeTab, showTokensSettings, showCollectiblesSettings]);

    return (
      <View
        className="flex-1"
        style={{ paddingHorizontal: pxValue(DEFAULT_PADDING) }}
      >
        <View className="flex-row items-center gap-3 mb-4">
          <TouchableOpacity
            disabled={shouldHideCollectibles}
            className="py-2"
            onPress={() => handleTabChange(TabType.TOKENS)}
            testID="tab-tokens"
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

          {!shouldHideCollectibles && (
            <TouchableOpacity
              className="py-2"
              onPress={() => handleTabChange(TabType.COLLECTIBLES)}
              testID="tab-collectibles"
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
          )}

          <View className="flex-1" />

          {showSettingsMenu && (
            <ContextMenuButton
              contextMenuProps={{
                actions:
                  activeTab === TabType.TOKENS
                    ? tokensMenuActions
                    : collectiblesMenuActions,
              }}
              side="bottom"
              align="end"
              sideOffset={8}
              testID="tab-settings-menu"
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
