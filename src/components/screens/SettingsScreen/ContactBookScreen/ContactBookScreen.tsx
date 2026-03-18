import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import ContextMenuButton, { MenuItem } from "components/ContextMenuButton";
import { BaseLayout } from "components/layout/BaseLayout";
import EditContactCard from "components/screens/SettingsScreen/ContactBookScreen/EditContactCard";
import useEditContactCard from "components/screens/SettingsScreen/ContactBookScreen/useEditContactCard";
import Avatar from "components/sds/Avatar";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { pxValue } from "helpers/dimensions";
import { truncateAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useRightHeaderButton } from "hooks/useRightHeader";
import { useToast } from "providers/ToastProvider";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, Platform, View } from "react-native";
import { analytics } from "services/analytics";

/**
 * Data stored for a single contact entry.
 *
 * @property name - Display name for the contact
 * @property resolvedAddress - Stellar address resolved from a federation lookup, if applicable
 */
export interface ContactData {
  name: string;
  resolvedAddress?: string;
}

/**
 * Map of Stellar address → ContactData, keyed by the raw input address
 * (which may be a federation address or a native Stellar address).
 */
export type ContactsMap = Record<string, ContactData>;

const icons = Platform.select({
  ios: {
    edit: "pencil",
    copy: "doc.on.doc",
    delete: "trash",
  },
  android: {
    edit: "baseline_edit",
    copy: "copy",
    delete: "baseline_delete",
  },
  default: {
    edit: "pencil",
    copy: "doc.on.doc",
    delete: "trash",
  },
});

/**
 * Discriminated union describing the current editing state of the contact card.
 * - `"add"` mode opens a blank form for a new contact.
 * - `"edit"` mode pre-populates the form with the selected contact's address and data.
 */
type CardMode =
  | { type: "add" }
  | { type: "edit"; address: string; data: ContactData };

/**
 * Wrapper that calls useEditContactCard and passes all state to the
 * presentational EditContactCard component.
 */
const EditContactCardWithHook: React.FC<{
  title: string;
  initialAddress?: string;
  initialName?: string;
  existingContacts: ContactsMap;
  onSave: (address: string, name: string, resolvedAddress?: string) => void;
  onCancel: () => void;
}> = ({
  title,
  initialAddress,
  initialName,
  existingContacts,
  onSave,
  onCancel,
}) => {
  const {
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
  } = useEditContactCard({
    initialAddress,
    initialName,
    existingContacts,
    onSave,
  });

  return (
    <EditContactCard
      title={title}
      address={address}
      name={name}
      addressError={addressError}
      nameError={nameError}
      isValidating={isValidating}
      isSaveDisabled={isSaveDisabled}
      onAddressChange={handleAddressChange}
      onNameChange={handleNameChange}
      onAddressBlur={handleAddressBlur}
      onNameBlur={handleNameBlur}
      onPaste={handlePaste}
      onSave={handleSave}
      onCancel={onCancel}
    />
  );
};

/**
 * Screen for managing the user's saved Stellar contacts.
 * Supports adding, editing, deleting, and copying contact addresses.
 */
const ContactBookScreen: React.FC = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { showToast } = useToast();
  const { copyToClipboard } = useClipboard();
  const [contacts, setContacts] = useState<ContactsMap>({});
  const [cardMode, setCardMode] = useState<CardMode | null>(null);
  const cardModeRef = useRef<CardMode | null>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  cardModeRef.current = cardMode;

  const handleAddContact = useCallback(() => {
    setCardMode({ type: "add" });
    bottomSheetRef.current?.present();
  }, []);

  useRightHeaderButton({
    onPress: handleAddContact,
    icon: Icon.Plus,
  });

  /**
   * Opens the edit card pre-populated with the selected contact's address and data.
   *
   * @param address - The address key of the contact to edit
   * @param data - The current data for the contact
   */
  const handleEditContact = useCallback(
    (address: string, data: ContactData) => {
      setCardMode({ type: "edit", address, data });
      bottomSheetRef.current?.present();
    },
    [],
  );

  /**
   * Saves a contact in add or edit mode.
   * In edit mode, replaces the old address key with the new one.
   * In add mode, inserts the contact and shows a success toast.
   *
   * @param address - The raw Stellar or federation address entered by the user
   * @param name - The display name for the contact
   * @param resolvedAddress - Federation-resolved Stellar address, if applicable
   */
  const handleSaveContact = useCallback(
    (address: string, name: string, resolvedAddress?: string) => {
      const currentCardMode = cardModeRef.current;
      if (currentCardMode?.type === "edit") {
        analytics.trackContactBookEdit();
        setContacts((prev) => {
          const result = { ...prev };
          delete result[currentCardMode.address];
          return { ...result, [address]: { name, resolvedAddress } };
        });
      } else if (currentCardMode?.type === "add") {
        analytics.trackContactBookAdd();
        setContacts((prev) => ({
          ...prev,
          [address]: { name, resolvedAddress },
        }));
        showToast({
          variant: "success",
          title: t("contactBookScreen.contactAdded"),
          icon: (
            <Icon.CheckCircle size={16} color={themeColors.status.success} />
          ),
          isFilled: true,
          toastId: "contact-added",
        });
      }
      bottomSheetRef.current?.dismiss();
    },
    [showToast, t, themeColors.status.success],
  );

  /**
   * Removes a contact by address and shows a success toast.
   *
   * @param address - The address key of the contact to delete
   */
  const handleDeleteContact = useCallback(
    (address: string) => {
      analytics.trackContactBookDelete();
      setContacts((prev) => {
        const result = { ...prev };
        delete result[address];
        return result;
      });
      showToast({
        variant: "success",
        title: t("contactBookScreen.contactDeleted"),
        icon: <Icon.CheckCircle size={16} color={themeColors.status.success} />,
        isFilled: true,
        toastId: "contact-deleted",
      });
    },
    [showToast, t, themeColors.status.success],
  );

  const sortedEntries = useMemo(
    () =>
      Object.entries(contacts).sort(([, a], [, b]) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      ),
    [contacts],
  );

  /**
   * Builds the context menu action items for a contact row.
   *
   * @param address - The contact's Stellar address
   * @param data - The contact's stored data
   * @returns Array of menu items for edit, copy, and delete actions
   */
  const getActions = useCallback(
    (address: string, data: ContactData): MenuItem[] => [
      {
        title: t("contactBookScreen.editContact"),
        systemIcon: icons.edit,
        onPress: () => {
          handleEditContact(address, data);
        },
      },
      {
        title: t("contactBookScreen.copyAddress"),
        systemIcon: icons.copy,
        onPress: () => {
          copyToClipboard(address);
        },
      },
      {
        title: t("contactBookScreen.deleteContact"),
        systemIcon: icons.delete,
        destructive: true,
        onPress: () => {
          handleDeleteContact(address);
        },
      },
    ],
    [t, handleEditContact, handleDeleteContact, copyToClipboard],
  );

  const renderContactItem = ({ item }: { item: [string, ContactData] }) => {
    const [address, data] = item;
    const slicedAddress = truncateAddress(address, 4, 4);

    return (
      <View className="flex-row items-center">
        <View className="flex-row flex-1 items-center gap-4">
          <Avatar size="lg" publicAddress={data.resolvedAddress || address} />
          <View className="flex-col">
            <Text md medium numberOfLines={1}>
              {data.name}
            </Text>
            <Text sm medium secondary numberOfLines={1}>
              {slicedAddress}
            </Text>
          </View>
        </View>
        <ContextMenuButton
          contextMenuProps={{ actions: getActions(address, data) }}
          testID={`contact-menu-${address}`}
        >
          <Icon.DotsHorizontal
            size={18}
            color={themeColors.foreground.secondary}
          />
        </ContextMenuButton>
      </View>
    );
  };

  const renderEmpty = () => (
    <View className="bg-background-tertiary rounded-xl items-center px-8 py-6 gap-3">
      <Icon.Users01 size={24} color={themeColors.primary} />
      <Text sm medium secondary style={{ textAlign: "center" }}>
        {t("contactBookScreen.empty")}
      </Text>
      <Button sm tertiary onPress={handleAddContact}>
        {t("contactBookScreen.addContact")}
      </Button>
    </View>
  );

  const handleDismissCard = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const cardTitle =
    cardMode?.type === "edit"
      ? t("contactBookScreen.editTitle")
      : t("contactBookScreen.addTitle");

  const existingContacts: ContactsMap =
    cardMode?.type === "edit"
      ? Object.fromEntries(
          Object.entries(contacts).filter(
            ([addr]) => addr !== cardMode.address,
          ),
        )
      : contacts;

  return (
    <BaseLayout insets={{ top: false }}>
      <FlatList
        data={sortedEntries}
        renderItem={renderContactItem}
        keyExtractor={([address]) => address}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: pxValue(32), paddingTop: pxValue(16) }}
      />
      <BottomSheet
        modalRef={bottomSheetRef}
        handleCloseModal={handleDismissCard}
        bottomSheetModalProps={{ onDismiss: () => setCardMode(null) }}
        enableDynamicSizing
        customContent={
          cardMode ? (
            <EditContactCardWithHook
              title={cardTitle}
              initialAddress={
                cardMode.type === "edit" ? cardMode.address : undefined
              }
              initialName={
                cardMode.type === "edit" ? cardMode.data.name : undefined
              }
              existingContacts={existingContacts}
              onSave={handleSaveContact}
              onCancel={handleDismissCard}
            />
          ) : null
        }
      />
    </BaseLayout>
  );
};

export default ContactBookScreen;
