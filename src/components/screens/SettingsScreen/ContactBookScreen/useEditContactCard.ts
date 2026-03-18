import Clipboard from "@react-native-clipboard/clipboard";
import { Federation } from "@stellar/stellar-sdk";
import { isFederationAddress, isValidStellarAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useRef, useState } from "react";

interface ContactData {
  address: string;
  name: string;
  resolvedAddress?: string;
}

type ContactsMap = Record<string, ContactData>;

interface UseEditContactCardParams {
  initialAddress?: string;
  initialName?: string;
  existingContacts: ContactsMap;
  onSave: (address: string, name: string, resolvedAddress?: string) => void;
}

const useEditContactCard = ({
  initialAddress = "",
  initialName = "",
  existingContacts,
  onSave,
}: UseEditContactCardParams) => {
  const { t } = useAppTranslation();
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
   * Checks whether a given address (and its optionally resolved account ID) already
   * exists in the contacts map.  Comparisons are performed at the account level so
   * that a federation address and the G/M address it resolves to are treated as the
   * same contact.
   *
   * @param normalized - The trimmed address as entered by the user
   * @param resolvedId - The resolved Stellar account ID when `normalized` is a federation address
   * @returns `true` if a duplicate contact is found
   */
  const isDuplicateAddress = (
    normalized: string,
    resolvedId: string | undefined,
  ): boolean => {
    const normalizedLower = normalized.toLowerCase();
    const resolvedLower = resolvedId?.toLowerCase();

    return Object.entries(existingContacts).some(([key, contact]) => {
      const keyLower = key.toLowerCase();
      const contactResolvedLower = contact.resolvedAddress?.toLowerCase();

      if (keyLower === normalizedLower) return true;

      if (resolvedLower) {
        if (contactResolvedLower && contactResolvedLower === resolvedLower)
          return true;
        if (isValidStellarAddress(key) && keyLower === resolvedLower)
          return true;
      }

      if (
        contactResolvedLower &&
        isValidStellarAddress(normalized) &&
        normalizedLower === contactResolvedLower
      )
        return true;

      return false;
    });
  };

  /**
   * Validates a Stellar address or federation address.
   * Resolves federation addresses asynchronously, checks address validity, and detects duplicates.
   *
   * @param val - The address string to validate
   * @param options.skipFederation - When true, skips federation resolution (used during typing to avoid excessive network calls)
   * @returns `true` if the address is valid
   */
  const validateAddress = async (
    val: string,
    { skipFederation = false } = {},
  ): Promise<boolean> => {
    const normalized = val.trim();
    // eslint-disable-next-line no-plusplus
    const validationId = ++validationIdRef.current;

    if (!normalized) {
      setAddressError(undefined);
      setAddressValidated(false);
      resolvedAddressRef.current = undefined;
      return false;
    }

    if (isFederationAddress(normalized)) {
      if (skipFederation) {
        setAddressError(undefined);
        setAddressValidated(false);
        return false;
      }
      setAddressValidated(false);
      resolvedAddressRef.current = undefined;
      try {
        const fedResp = await Federation.Server.resolve(normalized);
        if (validationId !== validationIdRef.current) return false;
        resolvedAddressRef.current = fedResp.account_id;
      } catch {
        if (validationId !== validationIdRef.current) return false;
        resolvedAddressRef.current = undefined;
        setAddressError(t("contactBookScreen.errors.federationNotFound"));
        return false;
      }
    } else if (!isValidStellarAddress(normalized)) {
      resolvedAddressRef.current = undefined;
      setAddressError(t("contactBookScreen.errors.invalidAddress"));
      return false;
    } else {
      resolvedAddressRef.current = undefined;
    }

    if (isDuplicateAddress(normalized, resolvedAddressRef.current)) {
      setAddressError(t("contactBookScreen.errors.duplicateAddress"));
      return false;
    }

    setAddressError(undefined);
    setAddressValidated(true);
    return true;
  };

  /**
   * Validates the contact name by trimming whitespace and checking for duplicates.
   *
   * @param val - The name string to validate
   * @returns `true` if the name is valid
   */
  const validateName = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setNameError(t("contactBookScreen.errors.emptyName"));
      setNameValidated(false);
      return false;
    }

    if (
      Object.values(existingContacts).some(
        (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setNameError(t("contactBookScreen.errors.duplicateName"));
      setNameValidated(false);
      return false;
    }

    setNameError(undefined);
    setNameValidated(true);
    return true;
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
    validateName(name);
  };

  const handleSave = async () => {
    setIsValidating(true);
    try {
      const addressValid = await validateAddress(address);
      const nameValid = validateName(name);
      if (addressValid && nameValid) {
        onSave(address.trim(), name.trim(), resolvedAddressRef.current);
      }
    } finally {
      setIsValidating(false);
    }
  };

  return {
    address,
    name,
    addressError,
    nameError,
    isValidating,
    isSaveDisabled,
    handleAddressChange,
    handleNameChange,
    handleAddressBlur,
    handleNameBlur,
    handlePaste,
    handleSave,
  };
};

export default useEditContactCard;
