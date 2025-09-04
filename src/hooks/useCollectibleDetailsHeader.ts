import { useNavigation } from "@react-navigation/native";
import Icon from "components/sds/Icon";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { useCollectiblesStore } from "ducks/collectibles";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import useDeviceStorage from "hooks/useDeviceStorage";
import { useRightHeaderMenu } from "hooks/useRightHeader";
import { useLayoutEffect, useMemo, useCallback } from "react";
import { Linking, Platform } from "react-native";

interface UseCollectibleDetailsHeaderProps {
  collectionAddress: string;
  collectibleName?: string;
  collectibleImage?: string;
}

/**
 * Custom hook for managing the CollectibleDetailsScreen header configuration.
 *
 * This hook handles:
 * - Setting the header title to the collectible name
 * - Setting up the right header context menu with collectible actions
 * - All menu action handlers (refresh metadata, view on stellar.expert, etc.)
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.collectionAddress - The collection address of the collectible
 * @param {string} params.collectibleName - The name of the collectible for the header title
 *
 * @example
 * ```tsx
 * const { handleViewInBrowser } = useCollectibleDetailsHeader({
 *   collectionAddress: "collection123",
 *   collectibleName: "My NFT"
 * });
 * ```
 */
export const useCollectibleDetailsHeader = ({
  collectionAddress,
  collectibleName,
  collectibleImage,
}: UseCollectibleDetailsHeaderProps) => {
  const navigation = useNavigation();
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const { fetchCollectibles } = useCollectiblesStore();
  const { saveToPhotos } = useDeviceStorage();

  /**
   * Sets the navigation header title to the collectible name.
   * Falls back to a default title if the collectible name is not available.
   */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: collectibleName || t("collectibleDetails.title"),
    });
  }, [navigation, collectibleName, t]);

  /**
   * Handles refreshing metadata for the collectible.
   * Calls fetchCollectibles to refresh collectible data from the API.
   */
  const handleRefreshMetadata = useCallback(async () => {
    try {
      await fetchCollectibles();
    } catch (error) {
      logger.error(
        "useCollectibleDetailsHeader",
        "Failed to refresh metadata:",
        error,
      );
    }
  }, [fetchCollectibles]);

  /**
   * Handles opening the collectible on stellar.expert explorer.
   * Constructs the appropriate URL based on the current network.
   */
  const handleViewOnStellarExpert = useCallback(async () => {
    try {
      const stellarExpertUrl = getStellarExpertUrl(network);
      const collectibleUrl = `${stellarExpertUrl}/contract/${collectionAddress}`;
      await Linking.openURL(collectibleUrl);
    } catch (error) {
      logger.error(
        "useCollectibleDetailsHeader",
        "Failed to open stellar.expert:",
        error,
      );
    }
  }, [network, collectionAddress]);

  /**
   * Platform-specific system icons for the context menu actions.
   */
  const systemIcons = useMemo(
    () =>
      Platform.select({
        ios: {
          refreshMetadata: "arrow.clockwise", // Circular arrow for refresh
          viewOnStellarExpert: "link", // Link/chain icon
          saveToPhotos: "square.and.arrow.down", // Save to photos icon
        },
        android: {
          refreshMetadata: "refresh", // Refresh icon (Material)
          viewOnStellarExpert: "link", // Link icon (Material)
          saveToPhotos: "place_item", // Save to photos icon (Material)
        },
      }),
    [],
  );

  /**
   * Handles saving the collectible to the photos library.
   */
  const handleSaveToPhotos = useCallback(async () => {
    if (!collectibleImage || !collectibleName) return;

    await saveToPhotos(collectibleImage, collectibleName);
  }, [collectibleImage, collectibleName, saveToPhotos]);

  /**
   * Context menu actions configuration with platform-specific icons.
   * Memoized to prevent unnecessary re-creation on re-renders.
   */
  const contextMenuActions = useMemo(
    () => [
      {
        title: t("collectibleDetails.refreshMetadata"),
        systemIcon: systemIcons?.refreshMetadata,
        onPress: handleRefreshMetadata,
      },
      {
        title: t("collectibleDetails.viewOnStellarExpert"),
        systemIcon: systemIcons?.viewOnStellarExpert,
        onPress: handleViewOnStellarExpert,
      },
      ...(collectibleImage
        ? [
            {
              title: t("collectibleDetails.saveToPhotos"),
              systemIcon: systemIcons?.saveToPhotos,
              onPress: handleSaveToPhotos,
            },
          ]
        : []),
    ],
    [
      t,
      systemIcons,
      handleRefreshMetadata,
      handleViewOnStellarExpert,
      handleSaveToPhotos,
      collectibleImage,
    ],
  );

  // Set up the right header menu
  useRightHeaderMenu({
    actions: contextMenuActions,
    icon: Icon.DotsHorizontal,
  });

  // Return any handlers that might be needed by the component
  return {
    handleRefreshMetadata,
    handleViewOnStellarExpert,
    handleSaveToPhotos,
  };
};
