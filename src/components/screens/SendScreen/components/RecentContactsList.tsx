import { DefaultListFooter } from "components/DefaultListFooter";
import { ContactRow } from "components/screens/SendScreen/components";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { FlatList, View, KeyboardAvoidingView, Platform } from "react-native";

interface RecentContact {
  id: string;
  address: string;
  name?: string;
}

interface RecentContactsListProps {
  transactions: RecentContact[];
  onContactPress: (address: string) => void;
  testID?: string;
}

/**
 * Header component for the recent contacts list
 *
 * @returns {JSX.Element} The rendered header component
 */
const ListHeader = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="mb-[24px]">
      <View className="flex-row items-center gap-2">
        <Icon.Clock size={16} color={themeColors.foreground.primary} />
        <Text md medium secondary>
          {t("sendPaymentScreen.recents")}
        </Text>
      </View>
    </View>
  );
};

/**
 * Displays a list of recent contacts/addresses
 *
 * @param {RecentContactsListProps} props - Component props
 * @returns {JSX.Element | null} The rendered component or null if no contacts
 */
export const RecentContactsList: React.FC<RecentContactsListProps> = ({
  transactions,
  onContactPress,
  testID,
}) => {
  if (!transactions.length) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      testID={testID}
    >
      <View className="flex-1">
        <FlatList
          data={transactions}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={DefaultListFooter}
          renderItem={({ item, index }) => (
            <ContactRow
              address={item.address}
              name={item.name}
              onPress={() => onContactPress(item.address)}
              className="mb-[24px]"
              testID={`recent-contact-${index}`}
            />
          )}
          keyExtractor={(item) => item.id}
        />
      </View>
    </KeyboardAvoidingView>
  );
};
