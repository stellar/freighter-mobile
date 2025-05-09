/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import {
  RecentContactsList,
  SearchSuggestionsList,
} from "components/screens/SendScreen/components";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { SEND_PAYMENT_ROUTES, SendPaymentStackParamList } from "config/routes";
import useAppTranslation from "hooks/useAppTranslation";
import { useClipboard } from "hooks/useClipboard";
import useColors from "hooks/useColors";
import React, { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";

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
  navigation,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const { getClipboardText } = useClipboard();
  const [address, setAddress] = useState("");

  // TODO: Replace with actual data from API/storage
  const [recentTransactions] = useState([
    {
      id: "1",
      address: "GA7M...63FC",
    },
    {
      id: "2",
      address: "CB2GPQAQJAJIGBXVQBMZ4GXMV7QSTA4LQASUAJXCD4ZYUKH2C25HKFQR",
    },
  ]);

  // Mock search suggestions data
  const [searchSuggestions, setSearchSuggestions] = useState<
    Array<{ id: string; address: string }>
  >([]);

  /**
   * Handles search input changes and updates suggestions
   *
   * @param {string} text - The search text entered by user
   */
  const handleSearch = (text: string) => {
    setAddress(text);
    if (text.length > 0) {
      // TODO: Replace with actual API call to search for addresses/contacts
      setSearchSuggestions([
        {
          id: "4",
          address: "CB2GPQAQJAJIGBXVQBMZ4GXMV7QSTA4LQASUAJXCD4ZYUKH2C25HKFQR",
        },
      ]);
    } else {
      setSearchSuggestions([]);
    }
  };

  /**
   * Handles when a contact or address is selected
   *
   * @param {string} contactAddress - The selected contact address
   */
  const handleContactPress = (contactAddress: string) => {
    navigation.navigate(SEND_PAYMENT_ROUTES.TRANSACTION_TOKEN_SCREEN, {
      address: contactAddress,
    });
  };

  /**
   * Gets text from clipboard and passes it to search handler
   */
  const handlePasteFromClipboard = () => {
    getClipboardText().then(handleSearch);
  };

  // Set up header with back button
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={themeColors.base[1]} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, themeColors]);

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
        </View>

        {searchSuggestions.length > 0 ? (
          <SearchSuggestionsList
            suggestions={searchSuggestions}
            onContactPress={handleContactPress}
          />
        ) : (
          recentTransactions.length > 0 && (
            <RecentContactsList
              transactions={recentTransactions}
              onContactPress={handleContactPress}
            />
          )
        )}
      </View>
    </BaseLayout>
  );
};

export default SendSearchContacts;
