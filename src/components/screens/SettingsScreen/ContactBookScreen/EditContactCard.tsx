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

/**
 * Props for the EditContactCard component.
 *
 * @property title - Title displayed at the top of the card ("Add Contact" or "Edit Contact")
 * @property address - Pre-populated Stellar address when editing an existing contact
 * @property name - Pre-populated display name when editing an existing contact
 * @property existingContacts - Map of contacts used for duplicate detection (excludes the contact being edited)
 * @property onSave - Callback invoked with the final address, name, and optional resolved address on save
 */
interface EditContactCardProps {
  title: string;
  address?: string;
  name?: string;
  existingContacts: ContactsMap;
  onSave: (address: string, name: string, resolvedAddress?: string) => void;
}

/**
 * Bottom-sheet form for adding or editing a Stellar contact.
 * Validates the address (including federation resolution) and name before calling onSave.
 */
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
  const validationIdRef = useRef(0);
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

  /**
   * Validates a Stellar address or federation address.
   * Resolves federation addresses asynchronously, checks address validity, and detects duplicates.
   *
   * @param val - The address string to validate
   * @param options.skipFederation - When true, skips federation resolution (used during typing to avoid excessive network calls)
   */
  const validateAddress = async (
    val: string,
    { skipFederation = false } = {},
  ) => {
    const normalized = val.trim();
    // eslint-disable-next-line no-plusplus
    const validationId = ++validationIdRef.current;

    if (!normalized) {
      setAddressError(undefined);
      setAddressValidated(false);
      resolvedAddressRef.current = undefined;
      return;
    }

    if (isFederationAddress(normalized)) {
      if (skipFederation) {
        setAddressError(undefined);
        setAddressValidated(false);
        return;
      }
      try {
        const fedResp = await Federation.Server.resolve(normalized);
        if (validationId !== validationIdRef.current) return;
        resolvedAddressRef.current = fedResp.account_id;
      } catch {
        if (validationId !== validationIdRef.current) return;
        resolvedAddressRef.current = undefined;
        setAddressError(t("contactBookScreen.errors.federationNotFound"));
        return;
      }
    } else if (!isValidStellarAddress(normalized)) {
      resolvedAddressRef.current = undefined;
      setAddressError(t("contactBookScreen.errors.invalidAddress"));
      return;
    } else {
      resolvedAddressRef.current = undefined;
    }

    if (
      Object.keys(existingContacts).some(
        (key) => key.toLowerCase() === normalized.toLowerCase(),
      )
    ) {
      setAddressError(t("contactBookScreen.errors.duplicateAddress"));
      return;
    }

    setAddressError(undefined);
    setAddressValidated(true);
  };

  /**
   * Validates the contact name by trimming whitespace and checking for duplicates.
   *
   * @param val - The name string to validate
   */
  const validateName = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setNameError(t("contactBookScreen.errors.emptyName"));
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

  /**
   * Reads the clipboard and sets the address field, then immediately validates it.
   */
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
    validateName(name);
  };

  /**
   * Performs full pre-save validation of both address and name fields.
   * Re-resolves federation addresses if needed and checks for duplicates.
   *
   * @returns Promise resolving to true if all fields are valid, false otherwise
   */
  const validate = async (): Promise<boolean> => {
    let isValid = true;
    const trimmedAddress = address.trim();

    if (isFederationAddress(trimmedAddress)) {
      try {
        const fedResp = await Federation.Server.resolve(trimmedAddress);
        resolvedAddressRef.current = fedResp.account_id;
      } catch {
        setAddressError(t("contactBookScreen.errors.federationNotFound"));
        resolvedAddressRef.current = undefined;
        isValid = false;
      }
    } else if (!isValidStellarAddress(trimmedAddress)) {
      setAddressError(t("contactBookScreen.errors.invalidAddress"));
      resolvedAddressRef.current = undefined;
      isValid = false;
    }

    if (
      isValid &&
      Object.keys(existingContacts).some(
        (key) => key.toLowerCase() === trimmedAddress.toLowerCase(),
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
        onSave(address.trim(), name.trim(), resolvedAddressRef.current);
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
