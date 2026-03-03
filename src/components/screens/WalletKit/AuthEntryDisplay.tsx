import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";

/**
 * Props for the AuthEntryDisplay component
 */
interface AuthEntryDisplayProps {
  /** The base64-encoded Soroban authorization entry XDR */
  entryXdr: string;
}

/**
 * AuthEntryDisplay component for showing Soroban authorization entry XDR
 * Displays the raw base64 XDR with a descriptive label and scrollable content
 *
 * @component
 * @param {AuthEntryDisplayProps} props - The component props
 * @returns {JSX.Element} The auth entry display component
 */
export const AuthEntryDisplay: React.FC<AuthEntryDisplayProps> = ({
  entryXdr,
}) => {
  const { themeColors } = useColors();
  const { t } = useTranslation();

  return (
    <View
      className="rounded-2xl p-4 my-3"
      style={{ backgroundColor: themeColors.background.secondary }}
      testID="auth-entry-display"
    >
      <View className="flex-row items-center gap-2 mb-4">
        <Icon.Code02 size={16} color={themeColors.text.secondary} />
        <Text
          sm
          secondary
          style={{ marginTop: 1 }}
          testID="auth-entry-display-prefix"
        >
          {t("common.authEntry")}
        </Text>
      </View>
      <ScrollView
        testID="auth-entry-display-content-scroll"
        style={{ maxHeight: 120 }}
      >
        <Text
          sm
          primary
          style={{ fontFamily: "monospace" }}
          testID="auth-entry-display-content"
        >
          {entryXdr}
        </Text>
      </ScrollView>
    </View>
  );
};
