import Avatar from "components/sds/Avatar";
import { StyledTextInput } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { View, TouchableOpacity } from "react-native";

interface UrlBarProps {
  inputUrl: string;
  onInputChange: (text: string) => void;
  onUrlSubmit: () => void;
  onShowTabs: () => void;
  tabsCount: number;
}

// Memoize to avoid unnecessary expensive re-renders
const UrlBar: React.FC<UrlBarProps> = React.memo(
  ({ inputUrl, onInputChange, onUrlSubmit, onShowTabs, tabsCount }) => {
    const { themeColors } = useColors();
    const { account } = useGetActiveAccount();
    const { t } = useAppTranslation();

    return (
      <View
        className="flex-row items-center gap-3 border-b border-border-primary"
        style={{
          paddingHorizontal: pxValue(DEFAULT_PADDING),
          paddingBottom: pxValue(13),
        }}
      >
        <Avatar size="xl" publicAddress={account?.publicKey ?? ""} />

        <StyledTextInput
          $fieldSize="lg"
          style={{
            borderColor: themeColors.border.primary,
            borderWidth: pxValue(1),
            borderRadius: pxValue(8),
            paddingHorizontal: pxValue(12),
          }}
          value={inputUrl}
          onChangeText={onInputChange}
          onSubmitEditing={onUrlSubmit}
          selectTextOnFocus
          placeholder={t("discovery.urlBarPlaceholder")}
          placeholderTextColor={themeColors.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
        />

        {/* Show Tabs Button */}
        <TouchableOpacity
          onPress={onShowTabs}
          className="w-14 h-14 border border-border-primary justify-center items-center"
          style={{
            borderRadius: pxValue(8),
          }}
        >
          <Text md semiBold>
            {tabsCount > 9 ? "9+" : tabsCount}
          </Text>
        </TouchableOpacity>
      </View>
    );
  },
);

UrlBar.displayName = "UrlBar";

export default UrlBar;
