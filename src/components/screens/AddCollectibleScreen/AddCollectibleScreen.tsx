import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { logger } from "config/logger";
import { ROOT_NAVIGATOR_ROUTES, RootStackParamList } from "config/routes";
import { isContractId } from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
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

      if (address.includes(" ")) {
        setCollectionAddressError(t("addCollectibleScreen.addressNoSpaces"));
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
        if (text) {
          setTokenId(text);
          validateTokenId(text);
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
    collectionAddress.trim() &&
    tokenId.trim() &&
    !collectionAddressError &&
    !tokenIdError;

  const handleButtonPress = useCallback(() => {
    if (isFormValid) {
      navigation.goBack();
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
    navigation,
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
        <Button xl tertiary onPress={handleButtonPress} isFullWidth>
          {buttonTitle}
        </Button>
      </View>
    </BaseLayout>
  );
};

export default AddCollectibleScreen;
