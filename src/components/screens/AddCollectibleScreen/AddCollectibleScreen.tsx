import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useState, useCallback, useRef } from "react";
import { View, TextInput, Alert } from "react-native";

export const AddCollectibleScreen: React.FC = () => {
  const { t } = useAppTranslation();
  const { getClipboardText } = useClipboard();
  const { themeColors } = useColors();

  const [collectionAddress, setCollectionAddress] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [collectionAddressError, setCollectionAddressError] = useState("");
  const [tokenIdError, setTokenIdError] = useState("");

  const collectionAddressRef = useRef<TextInput>(null);
  const tokenIdRef = useRef<TextInput>(null);

  const validateCollectionAddress = useCallback(
    (address: string) => {
      if (!address.trim()) {
        setCollectionAddressError("");
        return false;
      }

      if (!isContractId(address.trim())) {
        setCollectionAddressError(t("addCollectibleScreen.invalidAddress"));
        return false;
      }

      setCollectionAddressError("");
      return true;
    },
    [t],
  );

  const validateTokenId = useCallback(
    (id: string) => {
      if (!id.trim()) {
        setTokenIdError("");
        return false;
      }

      // Check if input contains spaces
      if (id.includes(" ")) {
        setTokenIdError(t("addCollectibleScreen.tokenIdNoSpaces"));
        return false;
      }

      setTokenIdError("");
      return true;
    },
    [t],
  );

  const handleCollectionAddressChange = useCallback(
    (text: string) => {
      setCollectionAddress(text);
      validateCollectionAddress(text);
    },
    [validateCollectionAddress],
  );

  const handleTokenIdChange = useCallback(
    (text: string) => {
      setTokenId(text);
      validateTokenId(text);
    },
    [validateTokenId],
  );

  const handlePasteCollectionAddress = useCallback(() => {
    getClipboardText()
      .then((text) => {
        if (text) {
          setCollectionAddress(text);
          validateCollectionAddress(text);
        }
      })
      .catch(() => {
        // Failed to get clipboard content
        // TODO: log error
      });
  }, [validateCollectionAddress, getClipboardText]);

  const handlePasteTokenId = useCallback(() => {
    getClipboardText()
      .then((text) => {
        if (text) {
          setTokenId(text);
          validateTokenId(text);
        }
      })
      .catch(() => {
        // Failed to get clipboard content
        // TODO: log error
      });
  }, [validateTokenId, getClipboardText]);

  const isFormValid =
    collectionAddress.trim() &&
    tokenId.trim() &&
    !collectionAddressError &&
    !tokenIdError;

  const handleButtonPress = useCallback(() => {
    if (isFormValid) {
      // TODO: fake a "add collectible" loading state
      // TODO: fake a "add collectible" success state
      // TODO: fake a "add collectible" error state
      // TODO: Implement add collectible logic
      Alert.alert(t("common.done"), t("addCollectibleScreen.toastSuccess"));
      return;
    }

    // Focus next available input field
    if (!collectionAddress.trim() || collectionAddressError) {
      collectionAddressRef.current?.focus();
    } else if (!tokenId.trim() || tokenIdError) {
      tokenIdRef.current?.focus();
    }
  }, [
    isFormValid,
    collectionAddress,
    tokenId,
    collectionAddressError,
    tokenIdError,
    t,
  ]);

  const buttonTitle = isFormValid
    ? t("addCollectibleScreen.addToWallet")
    : t("addCollectibleScreen.enterDetails");

  return (
    <BaseLayout useKeyboardAvoidingView insets={{ top: false }}>
      <View className="mb-6">
        <Input
          ref={collectionAddressRef}
          placeholder={t("addCollectibleScreen.collectionAddress")}
          value={collectionAddress}
          onChangeText={handleCollectionAddressChange}
          error={collectionAddressError}
          endButton={{
            content: (
              <Icon.Clipboard size={20} color={themeColors.text.secondary} />
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
              <Icon.Clipboard size={20} color={themeColors.text.secondary} />
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
        <Button xl tertiary onPress={handleButtonPress} isFullWidth>
          {buttonTitle}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default AddCollectibleScreen;
