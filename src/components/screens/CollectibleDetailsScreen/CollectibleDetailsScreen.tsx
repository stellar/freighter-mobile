import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { List } from "components/List";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { logger } from "config/logger";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useCollectibleDetailsHeader } from "hooks/useCollectibleDetailsHeader";
import { useCollectibles } from "hooks/useCollectibles";
import useColors from "hooks/useColors";
import React, { useMemo, useCallback } from "react";
import { Image, Linking, ScrollView, View } from "react-native";

type CollectibleDetailsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.COLLECTIBLE_DETAILS_SCREEN
>;

/**
 * CollectibleDetailsScreen Component
 *
 * A detailed view screen that displays comprehensive information about a specific NFT collectible.
 * This screen is navigated to when users tap on a collectible item from the CollectiblesGrid.
 *
 * Features:
 * - Large collectible image display (354x354) with fallback placeholder
 * - Basic metadata information (Name, Collection, Token ID) in a structured list
 * - Detailed description section
 * - Collectible traits/attributes displayed in a 2-column grid layout
 * - Conditional "View in Browser" button for external URLs
 * - Right header context menu with collectible actions (handled by useCollectibleDetailsHeader)
 * - Responsive layout with proper spacing and typography
 * - Error handling for missing collectibles
 *
 * @param {CollectibleDetailsScreenProps} props - Component props
 * @param {Object} props.route - Navigation route object containing collectible parameters
 * @param {Object} props.route.params - Route parameters
 * @param {string} props.route.params.collectionAddress - The collection address of the collectible
 * @param {string} props.route.params.tokenId - The unique token ID of the collectible
 * @param {Object} props.navigation - Navigation object for header configuration
 *
 * @returns {JSX.Element} The collectible details screen component
 *
 * @example
 * ```tsx
 * <CollectibleDetailsScreen
 *   route={{
 *     params: {
 *       collectionAddress: "collection123",
 *       tokenId: "token456"
 *     }
 *   }}
 *   navigation={navigation}
 * />
 * ```
 */
export const CollectibleDetailsScreen: React.FC<CollectibleDetailsScreenProps> =
  React.memo(({ route }) => {
    const { collectionAddress, tokenId } = route.params;
    const { t } = useAppTranslation();
    const { themeColors } = useColors();
    const { getCollectible } = useCollectibles();

    const basicInfoTitleColor = themeColors.text.secondary;

    /**
     * Retrieves the collectible data based on collection address and token ID.
     * Memoized to prevent unnecessary re-fetching on re-renders.
     */
    const collectible = useMemo(
      () => getCollectible({ collectionAddress, tokenId }),
      [getCollectible, collectionAddress, tokenId],
    );

    /**
     * Sets up the header configuration including title and context menu.
     * This hook handles all header-related logic.
     */
    useCollectibleDetailsHeader({
      collectionAddress,
      tokenId,
      collectibleName: collectible?.name,
    });

    /**
     * Prepares the list items for displaying basic collectible information.
     * Each item contains a title, title color, and trailing content (value).
     * Memoized to prevent unnecessary recreation of the array on re-renders.
     */
    const basicInfoItems = useMemo(
      () => [
        {
          key: "name",
          title: t("collectibleDetails.name"),
          titleColor: basicInfoTitleColor,
          trailingContent: (
            <Text md medium>
              {collectible?.name}
            </Text>
          ),
        },
        {
          key: "collection",
          title: t("collectibleDetails.collection"),
          titleColor: basicInfoTitleColor,
          trailingContent: (
            <Text md medium>
              {collectible?.collectionName}
            </Text>
          ),
        },
        {
          key: "tokenId",
          title: t("collectibleDetails.tokenId"),
          titleColor: basicInfoTitleColor,
          trailingContent: (
            <Text md medium>
              {collectible?.tokenId}
            </Text>
          ),
        },
      ],
      [
        t,
        basicInfoTitleColor,
        collectible?.name,
        collectible?.collectionName,
        collectible?.tokenId,
      ],
    );

    /**
     * Handles opening the collectible's external URL in the device's default browser.
     * Includes error logging for debugging purposes.
     *
     * @param {string} url - The external URL to open
     */
    const handleViewInBrowser = useCallback(async (url: string) => {
      try {
        await Linking.openURL(url);
      } catch (error) {
        logger.error(
          "CollectibleDetailsScreen",
          "Failed to open externalUrl in browser:",
          error,
        );
      }
    }, []);

    // If collectible is not found, show error state
    if (!collectible) {
      return (
        <BaseLayout insets={{ top: false }}>
          <View className="flex-1 items-center justify-center p-4">
            <Text lg medium secondary>
              {t("collectibleDetails.notFound")}
            </Text>
          </View>
        </BaseLayout>
      );
    }

    return (
      <BaseLayout
        insets={{ top: false, bottom: Boolean(collectible?.externalUrl) }}
      >
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: pxValue(40) }}
        >
          {/* Collectible Image */}
          <View className="w-[354px] h-[354px] rounded-[32px] overflow-hidden items-center justify-center bg-background-tertiary mt-2 mb-6">
            {/* Placeholder icon for when the image is not loaded */}
            <View className="absolute z-1">
              <Icon.Image01 size={90} color={themeColors.text.secondary} />
            </View>

            {/* NFT image */}
            <View className="absolute z-10 w-full h-full">
              <Image
                source={{ uri: collectible.image }}
                className="w-full h-full"
                resizeMode="cover"
              />
            </View>
          </View>

          {/* Basic Information */}
          <View className="mb-6">
            <List items={basicInfoItems} variant="secondary" />
          </View>

          {/* Description */}
          <View className="mb-6 bg-background-tertiary rounded-2xl p-4">
            <View className="mb-3">
              <Text md medium secondary>
                {t("collectibleDetails.description")}
              </Text>
            </View>
            <Text md medium>
              {collectible.description}
            </Text>
          </View>

          {/* Collectible Traits */}
          <View className="mb-6 bg-background-tertiary rounded-2xl px-4 pt-4 pb-1">
            <View className="mb-3">
              <Text md medium secondary>
                {t("collectibleDetails.traits")}
              </Text>
            </View>
            <View className="flex-row flex-wrap justify-between">
              {collectible.traits.map((trait) => (
                <View
                  key={`${trait.name}-${trait.value}`}
                  className="bg-background-secondary rounded-2xl p-4 w-[48%] mb-3 items-center justify-center"
                >
                  <Text sm medium textAlign="center">
                    {trait.value}
                  </Text>
                  <View className="mt-1">
                    <Text sm secondary textAlign="center">
                      {trait.name}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* View in browser button */}
        {collectible?.externalUrl && (
          <View className="mt-7">
            <Button
              tertiary
              xl
              isFullWidth
              icon={
                <Icon.LinkExternal01
                  size={18}
                  color={themeColors.foreground.primary}
                />
              }
              onPress={() => handleViewInBrowser(collectible?.externalUrl)}
            >
              {t("collectibleDetails.view")}
            </Button>
          </View>
        )}
      </BaseLayout>
    );
  });

CollectibleDetailsScreen.displayName = "CollectibleDetailsScreen";

export default CollectibleDetailsScreen;
