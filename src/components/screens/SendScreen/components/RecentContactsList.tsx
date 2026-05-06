import { ContactRow } from "components/screens/SendScreen/components";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

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
    <View testID={testID}>
      <ListHeader />
      {transactions.map((item, index) => (
        <ContactRow
          key={item.id}
          address={item.address}
          name={item.name}
          onPress={() => onContactPress(item.address)}
          className="mb-[24px]"
          testID={`recent-contact-${index}`}
        />
      ))}
    </View>
  );
};
