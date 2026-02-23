import { DefaultListFooter } from "components/DefaultListFooter";
import { ContactRow } from "components/screens/SendScreen/components";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
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
  testID?: string;
}

/**
 * Displays a list of search suggestions for addresses/contacts
 *
 * @param {SearchSuggestionsListProps} props - Component props
 * @returns {JSX.Element | null} The rendered component or null if no suggestions
 */
export const SearchSuggestionsList: React.FC<SearchSuggestionsListProps> = ({
  suggestions,
  onContactPress,
  testID,
}) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  if (!suggestions.length) {
    return null;
  }

  return (
    <View className="flex-1" testID={testID}>
      <View className="mb-[24px]">
        <View className="flex-row items-center gap-2">
          <Icon.SearchMd size={16} color={themeColors.foreground.primary} />
          <Text md medium secondary>
            {t("sendPaymentScreen.suggestions")}
          </Text>
        </View>
      </View>
      <FlatList
        keyboardShouldPersistTaps="handled"
        data={suggestions}
        renderItem={({ item, index }) => (
          <ContactRow
            address={item.address}
            name={item.name}
            onPress={() => onContactPress(item.address)}
            testID={`search-suggestion-${index}`}
          />
        )}
        keyExtractor={(item) => item.id}
        ListFooterComponent={DefaultListFooter}
      />
    </View>
  );
};
