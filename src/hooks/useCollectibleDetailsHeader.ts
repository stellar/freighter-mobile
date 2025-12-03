import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Icon from "components/sds/Icon";
import { logger } from "config/logger";
import { RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useCollectiblesStore } from "ducks/collectibles";
import { getStellarExpertUrl } from "helpers/stellarExpert";
import useAppTranslation from "hooks/useAppTranslation";
import useDeviceStorage from "hooks/useDeviceStorage";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useRightHeaderMenu } from "hooks/useRightHeader";
import { useToast } from "providers/ToastProvider";
import { useLayoutEffect, useMemo, useCallback } from "react";
import { Platform } from "react-native";

interface UseCollectibleDetailsHeaderProps {
  collectionAddress: string;
  collectibleName?: string;
  collectibleImage?: string;
  tokenId: string;
}

/**
 * Custom hook for managing the CollectibleDetailsScreen header configuration.
 *
 * This hook handles:
 * - Setting the header title to the collectible name
 * - Setting up the right header context menu with collectible actions
 * - All menu action handlers (refresh metadata, view on stellar.expert, save to photos, etc.)
 * - Hide/show collectible functionality (conditionally displayed based on collectible's hidden state)
 *
 * The context menu dynamically shows either "Hide collectible" or "Show collectible" option
 * based on whether the collectible is currently hidden or visible.
 *
 * @param {Object} params - Hook parameters
 * @param {string} params.collectionAddress - The collection address of the collectible
 * @param {string} params.collectibleName - The name of the collectible for the header title
 * @param {string} params.tokenId - The token ID of the collectible
 * @param {string} [params.collectibleImage] - Optional image URL for save to photos functionality
 *
 * @example
 * ```tsx
 * const { handleHideCollectible, handleShowCollectible } = useCollectibleDetailsHeader({
 *   collectionAddress: "collection123",
 *   collectibleName: "My NFT",
 *   tokenId: "token456"
 * });
 * ```
 *
 * @returns {Object} Object containing handler functions for collectible actions
 * @returns {Function} returns.handleRefreshMetadata - Handler to refresh collectible metadata
 * @returns {Function} returns.handleViewOnStellarExpert - Handler to view collectible on stellar.expert
 * @returns {Function} returns.handleSaveToPhotos - Handler to save collectible image to photos
 * @returns {Function} returns.handleRemoveCollectible - Handler to remove collectible from wallet
 * @returns {Function} returns.handleHideCollectible - Handler to hide a visible collectible
 * @returns {Function} returns.handleShowCollectible - Handler to show/unhide a hidden collectible
 */
export const useCollectibleDetailsHeader = ({
  collectionAddress,
  collectibleName,
  collectibleImage,
  tokenId,
}: UseCollectibleDetailsHeaderProps) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { t } = useAppTranslation();
  const { network } = useAuthenticationStore();
  const { account } = useGetActiveAccount();
  const {
    fetchCollectibles,
    removeCollectible,
    getCollectible,
    hideCollectible,
    unhideCollectible,
  } = useCollectiblesStore();
  const { saveToPhotos } = useDeviceStorage();
  const { open: openInAppBrowser } = useInAppBrowser();
  const { showToast } = useToast();

  // Get the collectible to check if it's hidden
  const collectible = useMemo(
    () => getCollectible({ collectionAddress, tokenId }),
    [getCollectible, collectionAddress, tokenId],
  );
  const isHidden = collectible?.isHidden ?? false;

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
      if (account?.publicKey && network) {
        await fetchCollectibles({ publicKey: account.publicKey, network });
      }
    } catch (error) {
      logger.error(
        "useCollectibleDetailsHeader",
        "Failed to refresh metadata:",
        error,
      );
    }
  }, [fetchCollectibles, account?.publicKey, network]);

  /**
   * Handles opening the collectible on stellar.expert explorer.
   * Constructs the appropriate URL based on the current network.
   */
  const handleViewOnStellarExpert = useCallback(async () => {
    try {
      const stellarExpertUrl = getStellarExpertUrl(network);
      const collectibleUrl = `${stellarExpertUrl}/contract/${collectionAddress}`;
      await openInAppBrowser(collectibleUrl);
    } catch (error) {
      logger.error(
        "useCollectibleDetailsHeader",
        "Failed to open stellar.expert:",
        error,
      );
    }
  }, [network, collectionAddress, openInAppBrowser]);

  /**
   * Handles removing the collectible from the wallet.
   * Removes the collectible from local storage and navigates back.
   */
  const handleRemoveCollectible = useCallback(async () => {
    try {
      if (account?.publicKey && network) {
        await removeCollectible({
          publicKey: account.publicKey,
          network,
          contractId: collectionAddress,
          tokenId,
        });

        // Navigate back after successful removal
        navigation.goBack();
      }
    } catch (error) {
      logger.error(
        "useCollectibleDetailsHeader",
        "Failed to remove collectible:",
        error,
      );
    }
  }, [
    removeCollectible,
    account?.publicKey,
    network,
    collectionAddress,
    tokenId,
    navigation,
  ]);

  /**
   * Handles hiding the collectible.
   * Adds the collectible to hidden collectibles storage, updates the store,
   * navigates back, and shows a success toast.
   */
  const handleHideCollectible = useCallback(async () => {
    try {
      if (account?.publicKey && network) {
        await hideCollectible({
          publicKey: account.publicKey,
          network,
          contractId: collectionAddress,
          tokenId,
        });

        // Navigate back after successful hide
        navigation.goBack();

        // Show success toast (with toastId to prevent stacking)
        showToast({
          title: t("collectibleDetails.hideSuccess"),
          variant: "success",
          toastId: "hide-collectible-success",
        });
      }
    } catch (error) {
      logger.error(
        "useCollectibleDetailsHeader",
        "Failed to hide collectible:",
        error,
      );
    }
  }, [
    hideCollectible,
    account?.publicKey,
    network,
    collectionAddress,
    tokenId,
    navigation,
    showToast,
    t,
  ]);

  /**
   * Handles showing (unhiding) the collectible.
   * Removes the collectible from hidden collectibles storage, updates the store,
   * and navigates back.
   */
  const handleShowCollectible = useCallback(async () => {
    try {
      if (account?.publicKey && network) {
        await unhideCollectible({
          publicKey: account.publicKey,
          network,
          contractId: collectionAddress,
          tokenId,
        });

        // Navigate all the way back to the home screen after successful unhide
        // so users can see the collectible in the collectibles grid right away
        navigation.popToTop();
      }
    } catch (error) {
      logger.error(
        "useCollectibleDetailsHeader",
        "Failed to show collectible:",
        error,
      );
    }
  }, [
    unhideCollectible,
    account?.publicKey,
    network,
    collectionAddress,
    tokenId,
    navigation,
  ]);

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
          hideCollectible: "eye.slash", // Eye slash icon for hiding
          showCollectible: "eye", // Eye icon for showing
          removeCollectible: "trash", // Trash icon for removal
        },
        android: {
          refreshMetadata: "refresh", // Refresh icon (Material)
          viewOnStellarExpert: "link", // Link icon (Material)
          saveToPhotos: "place_item", // Save to photos icon (Material)
          hideCollectible: "visibility_off", // Visibility off icon (Material)
          showCollectible: "visibility", // Visibility icon (Material)
          removeCollectible: "delete", // Delete icon (Material)
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
      // Show hide/show collectible option based on current state
      {
        title: isHidden
          ? t("collectibleDetails.showCollectible")
          : t("collectibleDetails.hideCollectible"),
        systemIcon: isHidden
          ? systemIcons?.showCollectible
          : systemIcons?.hideCollectible,
        onPress: isHidden ? handleShowCollectible : handleHideCollectible,
      },
      // Only show remove collectible in development mode for
      // testing purposes
      ...(__DEV__
        ? [
            {
              title: t("collectibleDetails.removeCollectible"),
              systemIcon: systemIcons?.removeCollectible,
              onPress: handleRemoveCollectible,
              destructive: true, // Mark as destructive action
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
      isHidden,
      handleHideCollectible,
      handleShowCollectible,
      handleRemoveCollectible,
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
    handleRemoveCollectible,
    handleHideCollectible,
    handleShowCollectible,
  };
};
