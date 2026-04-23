/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  RecentContactsList,
  SearchSuggestionsList,
} from "components/screens/SendScreen/components";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Notification } from "components/sds/Notification";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { CREATE_ACCOUNT_TUTORIAL_URL, QRCodeSource } from "config/constants";
import {
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
  SEND_PAYMENT_ROUTES,
  SendPaymentStackParamList,
} from "config/routes";
import { useQRDataStore } from "ducks/qrData";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useRightHeaderButton } from "hooks/useRightHeader";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { analytics } from "services/analytics";

type SendSearchContactsProps = NativeStackScreenProps<
  RootStackParamList & SendPaymentStackParamList,
  typeof SEND_PAYMENT_ROUTES.SEND_SEARCH_CONTACTS_SCREEN
>;

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
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { open: openInAppBrowser } = useInAppBrowser();
  const { getClipboardText } = useClipboard();
  const [address, setAddress] = useState("");
  const {
    saveRecipientAddress,
    saveFederationAddress,
    saveMemo,
    saveMemoType,
    selectedCollectibleDetails,
    saveSelectedCollectibleDetails,
  } = useTransactionSettingsStore();

  const { clearQRData } = useQRDataStore();

  const {
    recentAddresses,
    searchResults,
    searchError,
    isSearching,
    loadRecentAddresses,
    searchAddress,
    prepareForSearch,
    setDestinationAddress,
    resetSendRecipient,
    isValidDestination,
    isDestinationFunded,
  } = useSendRecipientStore();

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

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SEARCH_DEBOUNCE_MS = 300;

  /**
   * Handles search input changes with debounce to prevent flickering
   * messages and unnecessary intermediate requests while typing.
   *
   * @param {string} text - The search text entered by user
   */
  const handleSearch = useCallback(
    (text: string) => {
      setAddress(text);

      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }

      // Clear stale results/errors immediately so they don't linger during debounce
      prepareForSearch();

      searchDebounceRef.current = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        searchAddress(text);
      }, SEARCH_DEBOUNCE_MS);
    },
    [searchAddress, prepareForSearch],
  );

  // Clean up debounce timer on unmount
  useEffect(
    () => () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    },
    [],
  );

  /**
   * Handles when a contact or address is selected
   *
   * @param {string} contactAddress - The selected contact address (G... public key)
   * @param {string} [contactName] - The federation address if applicable
   */
  const handleContactPress = useCallback(
    async (contactAddress: string, contactName?: string) => {
      if (recentAddresses.some((c) => c.address === contactAddress)) {
        analytics.track(AnalyticsEvent.SEND_PAYMENT_RECENT_ADDRESS);
      }

      const isFederation = !!contactName;

      let resolvedAddress = contactAddress;

      // Re-resolve recent federation contacts to pick up any address remapping (H3)
      const isRecentContact = recentAddresses.some(
        (c) => c.address === contactAddress,
      );
      if (isFederation && isRecentContact) {
        setAddress(contactName);
        await searchAddress(contactName);
        const state = useSendRecipientStore.getState();
        if (state.searchError || state.searchResults.length === 0) {
          // searchError is shown in the UI; abort navigation
          return;
        }
        resolvedAddress = state.searchResults[0].address;
      }

      // Read federation memo/type from store — always fresh after any resolution above
      const {
        federationMemo: resolvedMemo,
        federationMemoType: resolvedMemoType,
      } = useSendRecipientStore.getState();

      // Save to both stores for different purposes
      // Send store is for contact management
      setDestinationAddress(
        resolvedAddress,
        isFederation ? contactName : undefined,
      );
      // Transaction settings store is for the transaction flow
      saveRecipientAddress(resolvedAddress);
      saveFederationAddress(isFederation ? contactName : "");
      // Apply federation memo and type; clear both for non-federation contacts (H2)
      saveMemo(isFederation && resolvedMemo ? resolvedMemo : "");
      saveMemoType(isFederation && resolvedMemoType ? resolvedMemoType : "");

      if (selectedCollectibleDetails.tokenId) {
        // Use popTo for collectible flow
        // If Review exists in stack, pops back to it; otherwise adds it
        navigation.popTo(
          SEND_PAYMENT_ROUTES.SEND_COLLECTIBLE_REVIEW,
          selectedCollectibleDetails,
        );
      } else {
        // For token sends, go back to the TransactionAmountScreen
        navigation.goBack();
      }
    },
    [
      recentAddresses,
      setDestinationAddress,
      saveRecipientAddress,
      saveFederationAddress,
      saveMemo,
      saveMemoType,
      searchAddress,
      navigation,
      selectedCollectibleDetails,
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

          {isSearching && address.length > 0 && (
            <View className="mt-8 items-center">
              <ActivityIndicator
                size="small"
                color={themeColors.foreground.primary}
              />
            </View>
          )}
          {searchError && !isSearching && (
            <View className="mt-4">
              <Text sm secondary>
                {searchError}
              </Text>
            </View>
          )}
          {!searchError &&
            !isSearching &&
            isValidDestination &&
            isDestinationFunded === false && (
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

        {searchResults.length > 0 ? (
          <SearchSuggestionsList
            suggestions={searchResults}
            onContactPress={(contactAddress, name) => {
              handleContactPress(contactAddress, name);
            }}
          />
        ) : (
          recentAddresses.length > 0 && (
            <RecentContactsList
              transactions={recentAddresses}
              onContactPress={(contactAddress, name) => {
                handleContactPress(contactAddress, name);
              }}
            />
          )
        )}
      </View>
    </BaseLayout>
  );
};

export default SendSearchContacts;
