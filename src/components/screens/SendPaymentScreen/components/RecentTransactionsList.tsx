import { ContactRow } from "components/screens/SendPaymentScreen/components";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { FlatList, View, KeyboardAvoidingView, Platform } from "react-native";

interface RecentTransaction {
  id: string;
  address: string;
  name?: string;
}

interface RecentTransactionsListProps {
  transactions: RecentTransaction[];
  onContactPress: (address: string) => void;
}

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

export const RecentTransactionsList: React.FC<RecentTransactionsListProps> = ({
  transactions,
  onContactPress,
}) => {
  if (!transactions.length) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
    >
      <View className="flex-1">
        <FlatList
          data={transactions}
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => (
            <ContactRow
              address={item.address}
              name={item.name}
              onPress={() => onContactPress(item.address)}
              showDots={false}
              className="mb-[24px]"
            />
          )}
          keyExtractor={(item) => item.id}
        />
      </View>
    </KeyboardAvoidingView>
  );
};
