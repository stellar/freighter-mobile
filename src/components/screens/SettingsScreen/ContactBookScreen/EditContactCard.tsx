import Clipboard from "@react-native-clipboard/clipboard";
import { Federation } from "@stellar/stellar-sdk";
import type { ContactsMap } from "components/screens/SettingsScreen/ContactBookScreen/ContactBookScreen";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { isFederationAddress, isValidStellarAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useRef, useState } from "react";
import { View } from "react-native";

interface EditContactCardProps {
  title: string;
  address?: string;
  name?: string;
  existingContacts: ContactsMap;
  onSave: (address: string, name: string, resolvedAddress?: string) => void;
}

const EditContactCard: React.FC<EditContactCardProps> = ({
  title: cardTitle,
  address: initialAddress = "",
  name: initialName = "",
  existingContacts,
  onSave,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const resolvedAddressRef = useRef<string | undefined>(undefined);
  const [address, setAddress] = useState(initialAddress);
  const [name, setName] = useState(initialName);
  const [addressError, setAddressError] = useState<string | undefined>();
  const [nameError, setNameError] = useState<string | undefined>();
  const [isValidating, setIsValidating] = useState(false);
  const [addressValidated, setAddressValidated] = useState(!!initialAddress);
  const [nameValidated, setNameValidated] = useState(!!initialName);

  const isSaveDisabled =
    isValidating ||
    !address ||
    !name.trim() ||
    !!addressError ||
    !!nameError ||
    !addressValidated ||
    !nameValidated;

  const validateAddress = async (
    val: string,
    { skipFederation = false } = {},
  ) => {
    if (!val) {
      setAddressError(undefined);
      setAddressValidated(false);
      resolvedAddressRef.current = undefined;
      return;
    }

    if (isFederationAddress(val)) {
      if (skipFederation) {
        setAddressError(undefined);
        setAddressValidated(false);
        return;
      }
      try {
        const fedResp = await Federation.Server.resolve(val);
        resolvedAddressRef.current = fedResp.account_id;
      } catch {
        resolvedAddressRef.current = undefined;
        setAddressError(t("contactBookScreen.errors.federationNotFound"));
        return;
      }
    } else if (!isValidStellarAddress(val)) {
      resolvedAddressRef.current = undefined;
      setAddressError(t("contactBookScreen.errors.invalidAddress"));
      return;
    } else {
      resolvedAddressRef.current = undefined;
    }

    if (
      Object.keys(existingContacts).some(
        (key) => key.toLowerCase() === val.toLowerCase(),
      )
    ) {
      setAddressError(t("contactBookScreen.errors.duplicateAddress"));
      return;
    }

    setAddressError(undefined);
    setAddressValidated(true);
  };

  const validateName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setNameError(undefined);
      setNameValidated(false);
      return;
    }

    if (
      Object.values(existingContacts).some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setNameError(t("contactBookScreen.errors.duplicateName"));
      return;
    }

    setNameError(undefined);
    setNameValidated(true);
  };

  const handlePaste = async () => {
    const clipboardContent = await Clipboard.getString();
    if (clipboardContent) {
      setAddress(clipboardContent);
      validateAddress(clipboardContent);
    }
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);
    validateAddress(text, { skipFederation: true });
  };

  const handleNameChange = (text: string) => {
    setName(text);
    validateName(text);
  };

  const handleAddressBlur = () => {
    validateAddress(address);
  };

  const handleNameBlur = () => {
    if (name) {
      validateName(name);
    }
  };

  const validate = async (): Promise<boolean> => {
    let isValid = true;

    if (isFederationAddress(address)) {
      try {
        const fedResp = await Federation.Server.resolve(address);
        resolvedAddressRef.current = fedResp.account_id;
      } catch {
        setAddressError(t("contactBookScreen.errors.federationNotFound"));
        resolvedAddressRef.current = undefined;
        isValid = false;
      }
    } else if (!isValidStellarAddress(address)) {
      setAddressError(t("contactBookScreen.errors.invalidAddress"));
      resolvedAddressRef.current = undefined;
      isValid = false;
    }

    if (
      isValid &&
      Object.keys(existingContacts).some(
        (key) => key.toLowerCase() === address.toLowerCase(),
      )
    ) {
      setAddressError(t("contactBookScreen.errors.duplicateAddress"));
      isValid = false;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError(t("contactBookScreen.errors.emptyName"));
      isValid = false;
    } else if (
      Object.values(existingContacts).some(
        (c) => c.name.toLowerCase() === trimmedName.toLowerCase(),
      )
    ) {
      setNameError(t("contactBookScreen.errors.duplicateName"));
      isValid = false;
    }

    return isValid;
  };

  const handleSave = async () => {
    setIsValidating(true);
    try {
      const isValid = await validate();
      if (isValid) {
        onSave(address, name.trim(), resolvedAddressRef.current);
      }
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <View className="bg-background-primary rounded-3xl p-6 gap-8">
      <View className="gap-4">
        <Text lg medium>
          {cardTitle}
        </Text>
        <View className="gap-3">
          <Input
            fieldSize="lg"
            value={address}
            onChangeText={handleAddressChange}
            onBlur={handleAddressBlur}
            placeholder={t("contactBookScreen.addressPlaceholder")}
            leftElement={
              <Icon.Wallet01
                size={16}
                color={themeColors.foreground.secondary}
              />
            }
            autoCapitalize="none"
            autoCorrect={false}
            error={addressError}
          />
          <Input
            fieldSize="lg"
            value={name}
            onChangeText={handleNameChange}
            onBlur={handleNameBlur}
            placeholder={t("contactBookScreen.namePlaceholder")}
            leftElement={
              <Icon.User01 size={16} color={themeColors.foreground.secondary} />
            }
            autoCorrect={false}
            error={nameError}
          />
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button xl secondary onPress={handlePaste}>
            {t("contactBookScreen.paste")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            xl
            primary
            onPress={handleSave}
            isLoading={isValidating}
            disabled={isSaveDisabled}
          >
            {t("contactBookScreen.save")}
          </Button>
        </View>
      </View>
    </View>
  );
};

export default EditContactCard;
