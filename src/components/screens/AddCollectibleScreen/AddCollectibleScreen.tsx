import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { logger } from "config/logger";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { useAuthenticationStore } from "ducks/auth";
import { useCollectiblesStore } from "ducks/collectibles";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useToast } from "providers/ToastProvider";
import React, { useState, useCallback, useRef } from "react";
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
  } = useCollectiblesStore();
  const { showToast } = useToast();

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
          setTokenIdError("This collectible is already in your wallet"); // TODO: add translations
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
        logger.error(
          "AddCollectibleScreen.handleBottomButtonPress",
          "Failed to add collectible",
          error,
        );

        // Show error toast
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

      <View className="mb-6">
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

      <View className="mb-8">
        <Text sm secondary>
          {t("addCollectibleScreen.description")}
        </Text>
      </View>

      <View className="mt-auto">
        <Button
          xl
          tertiary
          onPress={handleBottomButtonPress}
          isFullWidth
          isLoading={isAddingCollectible}
          disabled={isAddingCollectible}
        >
          {buttonTitle}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default AddCollectibleScreen;
