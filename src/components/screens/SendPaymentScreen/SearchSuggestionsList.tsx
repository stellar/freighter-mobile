import { ContactRow } from "components/screens/SendPaymentScreen/ContactRow";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import React from "react";
import { FlatList, View } from "react-native";

interface SearchSuggestion {
  id: string;
  address: string;
  name?: string;
}

interface SearchSuggestionsListProps {
  suggestions: SearchSuggestion[];
  onContactPress: (address: string) => void;
}

export const SearchSuggestionsList: React.FC<SearchSuggestionsListProps> = ({
  suggestions,
  onContactPress,
}) => {
  if (!suggestions.length) {
    return null;
  }

  return (
    <View className="flex-1">
      <View className="mb-[24px]">
        <View className="flex-row items-center gap-2">
          <Icon.SearchMd size={16} color={THEME.colors.foreground.primary} />
          <Text md medium secondary>
            Suggestions
          </Text>
        </View>
      </View>
      <FlatList
        data={suggestions}
        renderItem={({ item }) => (
          <ContactRow
            address={item.address}
            name={item.name}
            onPress={() => onContactPress(item.address)}
            className="mb-[24px]"
          />
        )}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};
