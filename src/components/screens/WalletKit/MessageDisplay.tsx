import { Text } from "components/sds/Typography";
import { SIGN_MESSAGE_PREFIX } from "helpers/stellar";
import useColors from "hooks/useColors";
import React from "react";
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
 *
 * @component
 * @param {MessageDisplayProps} props - The component props
 * @returns {JSX.Element} The message display component
 */
export const MessageDisplay: React.FC<MessageDisplayProps> = ({ message }) => {
  const { themeColors } = useColors();
  const isJson = isJsonString(message);

  // Format JSON with indentation for better readability
  const displayMessage = isJson
    ? JSON.stringify(JSON.parse(message), null, 2)
    : message;

  return (
    <View
      className="rounded-2xl p-4 my-3"
      style={{ backgroundColor: themeColors.background.secondary }}
    >
      <Text sm secondary style={{ marginBottom: 8 }}>
        {SIGN_MESSAGE_PREFIX}
      </Text>
      <ScrollView
        className="max-h-48"
        style={{
          maxHeight: 200,
        }}
      >
        <Text
          sm
          primary
          style={{
            fontFamily: isJson ? "monospace" : undefined,
          }}
        >
          {displayMessage}
        </Text>
      </ScrollView>
    </View>
  );
};
