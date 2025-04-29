import { ContactItem } from "components/screens/SendPaymentScreen/components";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
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
  const { themeColors } = useColors();
  
  if (!suggestions.length) {
    return null;
  }

  return (
    <View className="flex-1">
      <View className="mb-[24px]">
        <View className="flex-row items-center gap-2">
          <Icon.SearchMd size={16} color={themeColors.foreground.primary} />
          <Text md medium secondary>
            Suggestions
          </Text>
        </View>
      </View>
      <FlatList
        data={suggestions}
        renderItem={({ item }) => (
          <ContactItem
            contact={item}
            onPress={onContactPress}
          />
        )}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
};
