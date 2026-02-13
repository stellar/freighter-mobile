import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

/**
 * Props for the MessageDisplay component
 */
interface MessageDisplayProps {
  /** The message to display */
  message: string;
}

/**
 * Checks if a string is valid JSON
 */
const isJsonString = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * MessageDisplay component for showing SEP-53 messages
 * Displays the message with the SEP-53 prefix and handles JSON formatting
 * Dynamically increases height based on message length
 *
 * @component
 * @param {MessageDisplayProps} props - The component props
 * @returns {JSX.Element} The message display component
 */
export const MessageDisplay: React.FC<MessageDisplayProps> = ({ message }) => {
  const { themeColors } = useColors();
  const isJson = isJsonString(message);
  const { t } = useTranslation();

  // Format JSON with indentation for better readability
  const displayMessage = isJson
    ? JSON.stringify(JSON.parse(message), null, 2)
    : message;

  return (
    <View
      className="rounded-2xl p-4 my-3"
      style={{ backgroundColor: themeColors.background.secondary }}
      testID="message-display"
    >
      <View className="flex-row items-center gap-2 mb-4">
        <Icon.LayoutAlt03 size={16} color={themeColors.text.secondary} />
        <Text
          sm
          secondary
          style={{ marginTop: 1 }}
          testID="message-display-prefix"
        >
          {t("common.message")}
        </Text>
      </View>
      <ScrollView testID="message-display-content-scroll">
        <Text
          sm
          primary
          style={{
            fontFamily: isJson ? "monospace" : undefined,
          }}
          testID="message-display-content"
        >
          {displayMessage}
        </Text>
      </ScrollView>
    </View>
  );
};
