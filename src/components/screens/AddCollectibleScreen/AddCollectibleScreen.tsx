import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
import { CollectibleImage } from "components/CollectibleImage";
import HiddenItemsSheetContent, {
  HiddenItem,
} from "components/HiddenItemsSheetContent";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { TextButton } from "components/sds/TextButton";
import { Text } from "components/sds/Typography";
import { logger } from "config/logger";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useCollectiblesStore } from "ducks/collectibles";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useFilteredCollectibles } from "hooks/useFilteredCollectibles";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useToast } from "providers/ToastProvider";
import React, { useState, useCallback, useRef, useMemo } from "react";
import { View, TextInput } from "react-native";

type AddCollectibleScreenProps = NativeStackScreenProps<
  RootStackParamList,
  typeof ROOT_NAVIGATOR_ROUTES.ADD_COLLECTIBLE_SCREEN
>;

export const AddCollectibleScreen: React.FC<AddCollectibleScreenProps> = ({
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { getClipboardText } = useClipboard();
  const { themeColors } = useColors();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const {
    addCollectible,
    isLoading: isAddingCollectible,
    checkCollectibleExists,
    unhideCollectible,
  } = useCollectiblesStore();
  const { hiddenCollectibles } = useFilteredCollectibles();
  const { showToast } = useToast();
  const hiddenCollectiblesBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [unhidingKey, setUnhidingKey] = useState<string | null>(null);

  const [collectionAddress, setCollectionAddress] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [collectionAddressError, setCollectionAddressError] = useState("");
  const [tokenIdError, setTokenIdError] = useState("");

  const collectionAddressRef = useRef<TextInput>(null);
  const tokenIdRef = useRef<TextInput>(null);

  const validateCollectionAddress = useCallback(
    (address: string) => {
      if (!address) {
        setCollectionAddressError("");
        return;
      }

      if (address.includes(" ")) {
        setCollectionAddressError(t("addCollectibleScreen.addressNoSpaces"));
        return;
      }

      if (!isContractId(address)) {
        setCollectionAddressError(t("addCollectibleScreen.invalidAddress"));
        return;
      }

      setCollectionAddressError("");
    },
    [t],
  );

  const validateTokenId = useCallback(
    (id: string) => {
      if (!id) {
        setTokenIdError("");
        return;
      }

      if (id.includes(" ")) {
        setTokenIdError(t("addCollectibleScreen.tokenIdNoSpaces"));
        return;
      }

      // Check if collectible already exists
      if (collectionAddress && id) {
        const exists = checkCollectibleExists({
          contractId: collectionAddress,
          tokenId: id,
        });

        if (exists) {
          setTokenIdError(t("addCollectibleScreen.alreadyInWallet"));
          return;
        }
      }

      setTokenIdError("");
    },
    [t, collectionAddress, checkCollectibleExists],
  );

  const handleCollectionAddressChange = useCallback(
    (text: string) => {
      const trimmedText = text.trim();
      setCollectionAddress(trimmedText);
      validateCollectionAddress(trimmedText);
      // Re-validate token ID since it depends on collection address
      if (tokenId) {
        validateTokenId(tokenId);
      }
    },
    [validateCollectionAddress, validateTokenId, tokenId],
  );

  const handleTokenIdChange = useCallback(
    (text: string) => {
      const trimmedText = text.trim();
      setTokenId(trimmedText);
      validateTokenId(trimmedText);
    },
    [validateTokenId],
  );

  const handlePasteCollectionAddress = useCallback(() => {
    getClipboardText()
      .then((text) => {
        const trimmedText = text.trim();
        if (trimmedText) {
          setCollectionAddress(trimmedText);
          validateCollectionAddress(trimmedText);
        }
      })
      .catch((error) => {
        logger.error(
          "handlePasteCollectionAddress",
          "Failed to get clipboard content",
          error,
        );
      });
  }, [validateCollectionAddress, getClipboardText]);

  const handlePasteTokenId = useCallback(() => {
    getClipboardText()
      .then((text) => {
        const trimmedText = text.trim();
        if (trimmedText) {
          setTokenId(trimmedText);
          validateTokenId(trimmedText);
        }
      })
      .catch((error) => {
        logger.error(
          "handlePasteTokenId",
          "Failed to get clipboard content",
          error,
        );
      });
  }, [validateTokenId, getClipboardText]);

  const isFormValid =
    collectionAddress && tokenId && !collectionAddressError && !tokenIdError;

  const handleBottomButtonPress = useCallback(async () => {
    if (isFormValid) {
      try {
        await addCollectible({
          publicKey: account?.publicKey || "",
          network,
          contractId: collectionAddress,
          tokenId,
        });

        // Show success toast
        showToast({
          title: t("addCollectibleScreen.toastSuccess"),
          variant: "success",
        });

        // Navigate back after successful addition
        navigation.goBack();
      } catch (error) {
        // Show error toast with friendly error message
        showToast({
          toastId: "add-collectible-error",
          title: t("addCollectibleScreen.toastError", {
            errorMessage:
              error instanceof Error ? error.message : t("common.unknownError"),
          }),
          variant: "error",
        });
      }
      return;
    }

    // Focus next available input field
    if (!collectionAddress || collectionAddressError) {
      collectionAddressRef.current?.focus();
    } else if (!tokenId || tokenIdError) {
      tokenIdRef.current?.focus();
    }
  }, [
    isFormValid,
    collectionAddress,
    tokenId,
    collectionAddressError,
    tokenIdError,
    navigation,
    addCollectible,
    account?.publicKey,
    network,
    showToast,
    t,
  ]);

  const buttonTitle = isFormValid
    ? t("addCollectibleScreen.addToWallet")
    : t("addCollectibleScreen.enterDetails");

  /**
   * Unhides a collectible from the hidden-collectibles sheet and confirms
   * with a toast. The sheet stays open so several can be unhidden in a row.
   */
  const handleUnhideCollectible = useCallback(
    async ({
      collectionAddress: contractId,
      tokenId: collectibleTokenId,
    }: {
      collectionAddress: string;
      tokenId: string;
    }) => {
      const publicKey = account?.publicKey;
      const key = `${contractId}:${collectibleTokenId}`;

      if (!publicKey || unhidingKey) {
        return;
      }

      setUnhidingKey(key);

      try {
        await unhideCollectible({
          publicKey,
          network,
          contractId,
          tokenId: collectibleTokenId,
        });
        showToast({
          title: t("hiddenCollectibles.unhidden"),
          variant: "success",
          toastId: "unhide-collectible-toast",
        });
      } catch (error) {
        logger.error(
          "handleUnhideCollectible",
          "Failed to unhide collectible",
          error,
        );
        showToast({
          title: t("hiddenCollectibles.unhideError"),
          variant: "error",
          toastId: "unhide-collectible-toast",
        });
      } finally {
        setUnhidingKey(null);
      }
    },
    [account?.publicKey, unhidingKey, unhideCollectible, network, showToast, t],
  );

  const hiddenItems = useMemo<HiddenItem[]>(
    () =>
      hiddenCollectibles.flatMap((collection) =>
        collection.items.map((item) => {
          const key = `${item.collectionAddress}:${item.tokenId}`;

          return {
            id: key,
            leading: (
              <View className="size-10 rounded-lg overflow-hidden">
                <CollectibleImage
                  imageUri={item.image}
                  placeholderIconSize={16}
                />
              </View>
            ),
            title:
              item.name ??
              t("collectibles.fallbacks.tokenName", { tokenId: item.tokenId }),
            // The fallback title is already built from the id, so don't
            // repeat it underneath
            subtitle: item.name ? `#${item.tokenId}` : undefined,
            isUnhiding: unhidingKey === key,
            onUnhide: () =>
              handleUnhideCollectible({
                collectionAddress: item.collectionAddress,
                tokenId: item.tokenId,
              }),
          };
        }),
      ),
    [hiddenCollectibles, unhidingKey, handleUnhideCollectible, t],
  );

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
      <View className="mb-3">
        <Input
          ref={collectionAddressRef}
          placeholder={t("addCollectibleScreen.collectionAddress")}
          value={collectionAddress}
          onChangeText={handleCollectionAddressChange}
          error={collectionAddressError}
          endButton={{
            content: (
              <Icon.Clipboard size={18} color={themeColors.text.secondary} />
            ),
            onPress: handlePasteCollectionAddress,
          }}
        />
      </View>

      <View className="mb-3">
        <Input
          ref={tokenIdRef}
          placeholder={t("addCollectibleScreen.tokenId")}
          value={tokenId}
          onChangeText={handleTokenIdChange}
          error={tokenIdError}
          endButton={{
            content: (
              <Icon.Clipboard size={18} color={themeColors.text.secondary} />
            ),
            onPress: handlePasteTokenId,
          }}
        />
      </View>

      <View className="mb-3 self-end">
        <TextButton
          testID="add-collectible-show-hidden"
          text={t("addCollectibleScreen.showHidden")}
          variant="tertiary"
          className="py-1"
          hitSlop={{ top: 6, bottom: 6 }}
          onPress={() =>
            hiddenCollectiblesBottomSheetModalRef.current?.present()
          }
        />
      </View>

      <View className="mb-8">
        <Text sm secondary>
          {t("addCollectibleScreen.description")}
        </Text>
      </View>

      <View className="mt-auto">
        <Button
          xl
          secondary
          onPress={handleBottomButtonPress}
          isFullWidth
          isLoading={isAddingCollectible}
          disabled={isAddingCollectible}
        >
          {buttonTitle}
        </Button>
      </View>
      <BottomSheet
        modalRef={hiddenCollectiblesBottomSheetModalRef}
        // Lets drags scroll a long hidden list instead of moving the sheet
        enableContentPanningGesture={false}
        handleCloseModal={() =>
          hiddenCollectiblesBottomSheetModalRef.current?.dismiss()
        }
        customContent={
          <HiddenItemsSheetContent
            title={t("hiddenCollectibles.title")}
            emptyText={t("hiddenCollectibles.empty")}
            items={hiddenItems}
            onClose={() =>
              hiddenCollectiblesBottomSheetModalRef.current?.dismiss()
            }
            testID="hidden-collectibles-sheet"
          />
        }
      />
    </BaseLayout>
  );
};

export default AddCollectibleScreen;
