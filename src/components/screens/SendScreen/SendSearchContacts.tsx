import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { DefaultListFooter } from "components/DefaultListFooter";
import { BaseLayout } from "components/layout/BaseLayout";
import { ContactRow } from "components/screens/SendScreen/components";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Notification } from "components/sds/Notification";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import {
  CREATE_ACCOUNT_TUTORIAL_URL,
  DEFAULT_DEBOUNCE_DELAY,
  NATIVE_TOKEN_CODE,
  QRCodeSource,
} from "config/constants";
import { logger } from "config/logger";
import {
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  SEND_PAYMENT_ROUTES,
  SendPaymentStackParamList,
} from "config/routes";
import { Account, TokenTypeWithCustomToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useQRDataStore } from "ducks/qrData";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { getTokenType } from "helpers/balances";
import { isContractId } from "helpers/soroban";
import { isFederationAddress } from "helpers/stellar";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import useDebounce from "hooks/useDebounce";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, ListRenderItemInfo, View } from "react-native";
import { analytics } from "services/analytics";

type SendSearchContactsProps = NativeStackScreenProps<
  RootStackParamList & SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN
>;

enum ContactListItemType {
  ResultsHeader = "results-header",
  Suggestion = "suggestion",
  RecentHeader = "recent-header",
  Recent = "recent",
  WalletsHeader = "wallets-header",
  Wallet = "wallet",
}

type ContactListItem =
  | { type: ContactListItemType.ResultsHeader }
  | {
      type: ContactListItemType.Suggestion;
      id: string;
      address: string;
      name?: string;
    }
  | { type: ContactListItemType.RecentHeader }
  | {
      type: ContactListItemType.Recent;
      id: string;
      address: string;
      name?: string;
      itemIndex: number;
    }
  | { type: ContactListItemType.WalletsHeader }
  | {
      type: ContactListItemType.Wallet;
      id: string;
      publicKey: string;
      name: string;
    };

/**
 * SendSearchContacts Component
 *
 * The initial screen in the payment flow that allows users to search for
 * recipients by address or select from recent transactions.
 *
 * @param {SendSearchContactsProps} props - Component props including navigation
 * @returns {JSX.Element} The rendered component
 */
const SendSearchContacts: React.FC<SendSearchContactsProps> = ({
  navigation,
  route,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { allAccounts, account: activeAccount } = useAuthenticationStore();
  const { open: openInAppBrowser } = useInAppBrowser();
  const { getClipboardText } = useClipboard();
  const [address, setAddress] = useState("");
  const {
    saveRecipientAddress,
    saveRecipientName,
    selectedCollectibleDetails,
    saveSelectedCollectibleDetails,
    selectedTokenId,
  } = useTransactionSettingsStore();

  const { clearQRData } = useQRDataStore();

  const {
    recentAddresses,
    searchResults,
    searchError,
    loadRecentAddresses,
    searchAddress,
    prepareForSearch,
    setDestinationAddress,
    resetSendRecipient,
    isValidDestination,
    isDestinationFunded,
    destinationAddress,
  } = useSendRecipientStore();

  // The "destination is unfunded" notice is only relevant when both the
  // asset and the destination use the classic account ledger. Contract
  // token / collectible sends bypass the classic ledger on the asset side,
  // and contract (C...) destinations bypass it on the destination side —
  // their balances live in the token contract's storage, not in a classic
  // account or trustline.
  const isCollectibleSend = Boolean(selectedCollectibleDetails.tokenId);
  const isContractTokenSend =
    !!selectedTokenId &&
    getTokenType(selectedTokenId) === TokenTypeWithCustomToken.CUSTOM_TOKEN;
  const isContractDestination =
    !!destinationAddress && isContractId(destinationAddress);
  const shouldShowUnfundedNotice =
    !isCollectibleSend && !isContractTokenSend && !isContractDestination;

  const myWallets: Account[] = useMemo(
    () =>
      (allAccounts ?? []).filter(
        (acc) => acc.publicKey !== activeAccount?.publicKey,
      ),
    [allAccounts, activeAccount?.publicKey],
  ); // Already using useMemo to prevent keystroke-hot-path recomputation

  const debouncedSearchAddress = useDebounce((searchTerm: string) => {
    Promise.resolve(searchAddress(searchTerm)).catch((error) => {
      logger.warn(
        "SendSearchContacts",
        "Debounced recipient search failed",
        error,
      );
    });
  }, DEFAULT_DEBOUNCE_DELAY);

  // Load recent addresses when component mounts
  useEffect(() => {
    loadRecentAddresses();

    // Clear any previous search state on component mount
    resetSendRecipient();
  }, [loadRecentAddresses, resetSendRecipient]);

  // Clear collectible details and QR data when component unmounts (exiting send flow)
  useEffect(
    () => () => {
      clearQRData();
      // Clear collectible details when leaving SearchContacts
      // This ensures token flow doesn't accidentally use old collectible data
      saveSelectedCollectibleDetails({ collectionAddress: "", tokenId: "" });
    },
    [clearQRData, saveSelectedCollectibleDetails],
  );

  /**
   * Handles search input changes and updates suggestions
   *
   * @param {string} text - The search text entered by user
   */
  const handleSearch = useCallback(
    (text: string) => {
      setAddress(text);
      debouncedSearchAddress.cancel();

      const trimmedText = text.trim();

      if (!trimmedText) {
        // Reset search state but preserve recent addresses for display
        const { recentAddresses: currentRecents } =
          useSendRecipientStore.getState();
        useSendRecipientStore.setState({
          searchResults: [],
          searchError: null,
          isValidDestination: false,
          isDestinationFunded: null,
          destinationAddress: "",
          federationAddress: "",
          isSearching: false,
          recentAddresses: currentRecents,
        });
        return;
      }

      prepareForSearch();
      debouncedSearchAddress(trimmedText);
    },
    [debouncedSearchAddress, prepareForSearch],
  );

  const proceedAfterRecipientSelection = useCallback(
    (contactAddress: string, name?: string) => {
      if (selectedCollectibleDetails.tokenId) {
        // Navigate to collectible review screen after selecting recipient
        navigation.navigate(
          SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW,
          selectedCollectibleDetails,
        );
      } else if (route.params?.returnToSendScreen) {
        // Opened as an overlay from TransactionAmountScreen (SlideFromBottom).
        // Stores are already updated above — just dismiss back down.
        navigation.goBack();
      } else {
        navigation.navigate(SEND_PAYMENT_ROUTES.TRANSACTION_AMOUNT_SCREEN, {
          tokenId: selectedTokenId || NATIVE_TOKEN_CODE,
          recipientAddress: contactAddress,
          recipientName: name,
        });
      }
    },
    [
      navigation,
      route.params?.returnToSendScreen,
      selectedCollectibleDetails,
      selectedTokenId,
    ],
  );

  /**
   * Handles when a contact or address is selected
   *
   * @param {string} contactAddress - The selected contact address
   */
  const handleContactPress = useCallback(
    (contactAddress: string, contactName?: string) => {
      if (recentAddresses.some((c) => c.address === contactAddress)) {
        analytics.track(AnalyticsEvent.SEND_PAYMENT_RECENT_ADDRESS);
      }
      let federationLabel = "";
      if (isFederationAddress(contactAddress)) {
        federationLabel = contactAddress;
      } else if (contactName && isFederationAddress(contactName)) {
        federationLabel = contactName;
      }
      const recipientLabel = federationLabel ? "" : (contactName ?? "");

      // If contactAddress is a federation address (from search), use destinationAddress
      // (which was resolved during searchAddress). Otherwise, contactAddress is already
      // resolved (from recent contacts or direct public key), so use it as-is.
      const addressToSave = isFederationAddress(contactAddress)
        ? destinationAddress
        : contactAddress;

      // Save to both stores for different purposes
      // Send store is for contact management
      setDestinationAddress(addressToSave, federationLabel || undefined);
      // Transaction settings store is for the transaction flow
      saveRecipientAddress(addressToSave);
      saveRecipientName(recipientLabel);

      proceedAfterRecipientSelection(
        addressToSave,
        federationLabel || recipientLabel || undefined,
      );
    },
    [
      recentAddresses,
      destinationAddress,
      setDestinationAddress,
      saveRecipientAddress,
      saveRecipientName,
      proceedAfterRecipientSelection,
    ],
  );

  const listData = useMemo<ContactListItem[]>(() => {
    const items: ContactListItem[] = [];
    const isTyping = address.trim().length > 0;

    if (isTyping && searchResults.length > 0) {
      items.push({ type: ContactListItemType.ResultsHeader });
      searchResults.forEach((result) => {
        items.push({ type: ContactListItemType.Suggestion, ...result });
      });
    }

    if (recentAddresses.length > 0) {
      items.push({ type: ContactListItemType.RecentHeader });
      recentAddresses.forEach((addr, itemIndex) => {
        items.push({ type: ContactListItemType.Recent, ...addr, itemIndex });
      });
    }

    if (myWallets.length > 0) {
      items.push({ type: ContactListItemType.WalletsHeader });
      myWallets.forEach((wallet) => {
        items.push({
          type: ContactListItemType.Wallet,
          id: wallet.id,
          publicKey: wallet.publicKey,
          name: wallet.name,
        });
      });
    }

    return items;
  }, [address, searchResults, recentAddresses, myWallets]);

  const renderContactItem = useCallback(
    ({ item }: ListRenderItemInfo<ContactListItem>) => {
      if (item.type === ContactListItemType.ResultsHeader) {
        return (
          <View className="mb-[12px]">
            <View className="flex-row items-center gap-[6px]">
              <View className="w-[24px] h-[24px] rounded-[6px] items-center justify-center bg-gray-3">
                <Icon.SearchMd size={14} color={themeColors.text.secondary} />
              </View>
              <Text sm semiBold secondary>
                {t("sendPaymentScreen.suggestions")}
              </Text>
            </View>
          </View>
        );
      }

      if (item.type === ContactListItemType.Suggestion) {
        return (
          <ContactRow
            address={item.address}
            name={item.name}
            onPress={() => handleContactPress(item.address, item.name)}
            className="mb-[24px]"
          />
        );
      }

      if (item.type === ContactListItemType.RecentHeader) {
        return (
          <View className="mb-[12px]">
            <View className="flex-row items-center gap-[6px]">
              <View className="w-[24px] h-[24px] rounded-[6px] items-center justify-center bg-gray-3">
                <Icon.Clock size={14} color={themeColors.text.secondary} />
              </View>
              <Text sm semiBold secondary>
                {t("sendPaymentScreen.recents")}
              </Text>
            </View>
          </View>
        );
      }

      if (item.type === ContactListItemType.Recent) {
        return (
          <ContactRow
            address={item.address}
            name={item.name}
            onPress={() => handleContactPress(item.address, item.name)}
            className="mb-[24px]"
            testID={`recent-contact-${item.itemIndex}`}
          />
        );
      }

      if (item.type === ContactListItemType.WalletsHeader) {
        return (
          <View className="flex-row items-center gap-[6px] mb-[12px]">
            <View className="w-[24px] h-[24px] rounded-[6px] items-center justify-center bg-gray-3">
              <Icon.Wallet01 size={14} color={themeColors.text.secondary} />
            </View>
            <Text sm semiBold secondary>
              {t("sendSearchContacts.myWallets")}
            </Text>
          </View>
        );
      }

      if (item.type === ContactListItemType.Wallet) {
        return (
          <ContactRow
            testID={`my-wallet-row-${item.id}`}
            address={item.publicKey}
            name={item.name}
            onPress={() => {
              setDestinationAddress(item.publicKey);
              saveRecipientAddress(item.publicKey);
              saveRecipientName(item.name);
              proceedAfterRecipientSelection(item.publicKey, item.name);
            }}
            className="mb-[24px]"
          />
        );
      }

      return null;
    },
    [
      handleContactPress,
      proceedAfterRecipientSelection,
      saveRecipientAddress,
      saveRecipientName,
      setDestinationAddress,
      t,
      themeColors.text.secondary,
    ],
  );

  const handlePasteFromClipboard = () => {
    getClipboardText().then(handleSearch);
  };

  const handleOpenQRScanner = useCallback(() => {
    // Navigate to the root navigator's QR scanner screen
    navigation.navigate(ROOT_NAVIGATOR_ROUTES.SCAN_QR_CODE_SCREEN, {
      source: QRCodeSource.ADDRESS_INPUT,
    });
  }, [navigation]);

  // Set up the QR code button in the header
  useRightHeaderButton({
    onPress: handleOpenQRScanner,
    icon: Icon.Scan,
    iconSize: 20,
  });

  const shouldShowSearchError = address.trim().length > 0 && !!searchError;

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1" testID="send-search-contacts-screen">
        <View className="mb-8">
          <Input
            fieldSize="lg"
            leftElement={
              <Icon.UserCircle
                size={16}
                color={themeColors.foreground.primary}
              />
            }
            testID="send-recipient-input"
            placeholder={t("sendPaymentScreen.inputPlaceholder")}
            onChangeText={handleSearch}
            endButton={{
              content: t("common.paste"),
              onPress: handlePasteFromClipboard,
            }}
            value={address}
          />

          {shouldShowSearchError && (
            <View className="mt-4">
              <Text sm secondary>
                {searchError}
              </Text>
            </View>
          )}
          {!searchError &&
            isValidDestination &&
            isDestinationFunded === false &&
            shouldShowUnfundedNotice && (
              <View className="mt-4">
                <Notification
                  variant="primary"
                  title={t("sendSearchContacts.unfunded.title")}
                  accessibilityLabel={`${t(
                    "sendSearchContacts.unfunded.title",
                  )} ${t("sendSearchContacts.unfunded.action")}`}
                  message={
                    <Text md secondary>
                      {t("sendSearchContacts.unfunded.action")}{" "}
                      <Text md semiBold color={themeColors.primary}>
                        {t("sendSearchContacts.unfunded.learnMore")}
                      </Text>
                    </Text>
                  }
                  onPress={() => {
                    openInAppBrowser(CREATE_ACCOUNT_TUTORIAL_URL);
                  }}
                />
              </View>
            )}
        </View>

        <FlatList
          data={listData}
          renderItem={renderContactItem}
          keyExtractor={(item) =>
            item.type === ContactListItemType.Recent ||
            item.type === ContactListItemType.Wallet ||
            item.type === ContactListItemType.Suggestion
              ? item.id
              : item.type
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListFooterComponent={DefaultListFooter}
        />
      </View>
    </BaseLayout>
  );
};

export default SendSearchContacts;
