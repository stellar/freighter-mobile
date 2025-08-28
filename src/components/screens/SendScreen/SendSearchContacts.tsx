/* eslint-disable react/no-unstable-nested-components */
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  RecentContactsList,
  SearchSuggestionsList,
} from "components/screens/SendScreen/components";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import { useSendRecipientStore } from "ducks/sendRecipient";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { analytics } from "services/analytics";

type SendSearchContactsProps = NativeStackScreenProps<
  SendPaymentStackParamList,
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
  route,
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { getClipboardText } = useClipboard();
  const [address, setAddress] = useState("");
  const { saveRecipientAddress, resetSettings, saveSelectedTokenId } =
    useTransactionSettingsStore();

  const { tokenId } = route.params || {};

  const {
    recentAddresses,
    searchResults,
    searchError,
    loadRecentAddresses,
    searchAddress,
    setDestinationAddress,
    resetSendRecipient,
  } = useSendRecipientStore();

  // Load recent addresses when component mounts
  useEffect(() => {
    loadRecentAddresses();

    // Clear any previous search state on component mount
    resetSendRecipient();

    if (!tokenId) {
      resetSettings();
    }

    if (tokenId) {
      saveSelectedTokenId(tokenId);
    }
  }, [
    loadRecentAddresses,
    resetSendRecipient,
    resetSettings,
    tokenId,
    saveSelectedTokenId,
  ]);

  // Reset search input and store state when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      setAddress("");
      resetSendRecipient();

      if (!tokenId) {
        resetSettings();
      }
    }, [resetSendRecipient, resetSettings, tokenId]),
  );

  /**
   * Handles search input changes and updates suggestions
   *
   * @param {string} text - The search text entered by user
   */
  const handleSearch = (text: string) => {
    setAddress(text);
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    searchAddress(text);
  };

  /**
   * Handles when a contact or address is selected
   *
   * @param {string} contactAddress - The selected contact address
   */
  const handleContactPress = (contactAddress: string) => {
    if (recentAddresses.some((c) => c.address === contactAddress)) {
      analytics.track(AnalyticsEvent.SEND_PAYMENT_RECENT_ADDRESS);
    }
    // Save to both stores for different purposes
    // Send store is for contact management
    setDestinationAddress(contactAddress);
    // Transaction settings store is for the transaction flow
    saveRecipientAddress(contactAddress);

    navigation.goBack();
  };

  const handlePasteFromClipboard = () => {
    getClipboardText().then(handleSearch);
  };

  return (
    <BaseLayout insets={{ top: false }}>
      <View className="flex-1">
        <View className="mb-8">
          <Input
            fieldSize="lg"
            leftElement={
              <Icon.UserCircle
                size={16}
                color={themeColors.foreground.primary}
              />
            }
            testID="search-input"
            placeholder={t("sendPaymentScreen.inputPlaceholder")}
            onChangeText={handleSearch}
            endButton={{
              content: t("common.paste"),
              onPress: handlePasteFromClipboard,
            }}
            value={address}
          />

          {searchError && (
            <View className="mt-4">
              <Text sm secondary>
                {searchError}
              </Text>
            </View>
          )}
        </View>

        {searchResults.length > 0 ? (
          <SearchSuggestionsList
            suggestions={searchResults}
            onContactPress={handleContactPress}
          />
        ) : (
          recentAddresses.length > 0 && (
            <RecentContactsList
              transactions={recentAddresses}
              onContactPress={handleContactPress}
            />
          )
        )}
      </View>
    </BaseLayout>
  );
};

export default SendSearchContacts;
