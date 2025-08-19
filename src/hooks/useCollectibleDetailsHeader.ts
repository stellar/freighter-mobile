import { useNavigation } from "@react-navigation/native";
import Icon from "components/sds/Icon";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { useCollectiblesStore } from "ducks/collectibles";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import { useRightHeaderMenu } from "hooks/useRightHeader";
import { useLayoutEffect, useMemo, useCallback } from "react";
import { Linking, Platform } from "react-native";

/**
 * Custom hook for managing the CollectibleDetailsScreen header configuration.
 *
 * This hook handles:
 * - Setting the header title to the collectible name
 * - Setting up the right header context menu with collectible actions
 * - All menu action handlers (refresh metadata, save to photos, view on stellar.expert, report as spam)
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.collectionAddress - The collection address of the collectible
 * @param {string} params.tokenId - The unique token ID of the collectible
 * @param {string} params.collectibleName - The name of the collectible for the header title
 *
 * @example
 * ```tsx
 * const { handleViewInBrowser } = useCollectibleDetailsHeader({
 *   collectionAddress: "collection123",
 *   tokenId: "token456",
 *   collectibleName: "My NFT"
 * });
 * ```
 */
export const useCollectibleDetailsHeader = ({
  collectionAddress,
  tokenId,
  collectibleName,
}: {
  collectionAddress: string;
  tokenId: string;
  collectibleName?: string;
}) => {
  const navigation = useNavigation();
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const { fetchCollectibles } = useCollectiblesStore();

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
   * Handles saving the collectible image to the device's photo library.
   * Currently a placeholder for future implementation.
   */
  const handleSaveToPhotos = useCallback(async () => {
    try {
      // TODO: Implement save to photos functionality
      // This would require additional permissions and native modules
      logger.info(
        "useCollectibleDetailsHeader",
        "Saving collectible image to photos",
        {
          collectionAddress,
          tokenId,
        },
      );
    } catch (error) {
      logger.error(
        "useCollectibleDetailsHeader",
        "Failed to save to photos:",
        error,
      );
    }
  }, [collectionAddress, tokenId]);

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
   * Handles reporting the collectible as spam.
   * Currently a placeholder for future implementation.
   */
  const handleReportAsSpam = useCallback(async () => {
    try {
      // TODO: Implement spam reporting logic
      logger.info(
        "useCollectibleDetailsHeader",
        "Reporting collectible as spam",
        {
          collectionAddress,
          tokenId,
        },
      );
    } catch (error) {
      logger.error(
        "useCollectibleDetailsHeader",
        "Failed to report as spam:",
        error,
      );
    }
  }, [collectionAddress, tokenId]);

  /**
   * Platform-specific system icons for the context menu actions.
   */
  const systemIcons = useMemo(
    () =>
      Platform.select({
        ios: {
          refreshMetadata: "arrow.clockwise", // Circular arrow for refresh
          saveToPhotos: "square.and.arrow.down", // Download/save icon
          viewOnStellarExpert: "link", // Link/chain icon
          reportAsSpam: "flag", // Flag icon for reporting as spam
        },
        android: {
          refreshMetadata: "refresh", // Refresh icon (Material)
          saveToPhotos: "download", // Download icon (Material)
          viewOnStellarExpert: "link", // Link icon (Material)
          reportAsSpam: "outlined_flag", // Flag icon (Material)
        },
      }),
    [],
  );

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
        title: t("collectibleDetails.saveToPhotos"),
        systemIcon: systemIcons?.saveToPhotos,
        onPress: handleSaveToPhotos,
      },
      {
        title: t("collectibleDetails.viewOnStellarExpert"),
        systemIcon: systemIcons?.viewOnStellarExpert,
        onPress: handleViewOnStellarExpert,
      },
      {
        title: t("collectibleDetails.reportAsSpam"),
        systemIcon: systemIcons?.reportAsSpam,
        onPress: handleReportAsSpam,
        destructive: true,
      },
    ],
    [
      t,
      systemIcons,
      handleRefreshMetadata,
      handleSaveToPhotos,
      handleViewOnStellarExpert,
      handleReportAsSpam,
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
    handleSaveToPhotos,
    handleViewOnStellarExpert,
    handleReportAsSpam,
  };
};
