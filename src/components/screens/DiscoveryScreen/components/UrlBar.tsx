import Avatar from "components/sds/Avatar";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React from "react";
import { View, TextInput, TouchableOpacity } from "react-native";

interface UrlBarProps {
  inputUrl: string;
  onInputChange: (text: string) => void;
  onUrlSubmit: () => void;
  onShowTabs: () => void;
  tabsCount: number;
}

const UrlBar: React.FC<UrlBarProps> = React.memo(
  ({ inputUrl, onInputChange, onUrlSubmit, onShowTabs, tabsCount }) => {
    const { themeColors } = useColors();
    const { account } = useGetActiveAccount();

    return (
      <View className="flex-row items-center p-4 gap-3 bg-background-primary border-b border-border-default">
        <Avatar size="md" publicAddress={account?.publicKey ?? ""} />

        <TextInput
          value={inputUrl}
          onChangeText={onInputChange}
          onSubmitEditing={onUrlSubmit}
          selectTextOnFocus
          placeholder="Search or enter a website"
          className="flex-1 px-3 py-2 h-10 bg-transparent border border-border-primary rounded-lg text-text-primary"
          placeholderTextColor={themeColors.text.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
        />

        {/* Show Tabs Button */}
        <TouchableOpacity
          onPress={onShowTabs}
          className="w-10 h-10 border border-border-primary rounded-lg justify-center items-center bg-transparent"
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
