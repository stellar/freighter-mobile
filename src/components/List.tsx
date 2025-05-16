import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import React from "react";
import { View, TouchableOpacity } from "react-native";

interface ListItemProps {
  icon?: React.ReactNode;
  title: string;
  titleColor?: string;
  trailingContent?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}

interface ListProps {
  items: ListItemProps[];
  variant?: "filled" | "transparent";
  className?: string;
  hideDivider?: boolean;
  compact?: boolean;
}

export const List: React.FC<ListProps> = ({
  items,
  variant = "filled",
  className,
  hideDivider = false,
  compact = false,
}) => (
  <View
    className={`${variant === "filled" ? "bg-background-secondary rounded-[12px]" : ""} ${className}`}
  >
    {items.map((item, index) => (
      <React.Fragment key={item.title}>
        <TouchableOpacity
          disabled={!item.onPress}
          onPress={item.onPress}
          testID={item.testID}
          className={`flex-row items-center gap-3 ${compact ? "py-2" : "p-4"}`}
        >
          {item.icon}
          <View className="flex-1">
            <Text
              md
              semiBold
              color={item.titleColor || THEME.colors.text.primary}
            >
              {item.title}
            </Text>
          </View>
          {item.trailingContent}
        </TouchableOpacity>
        {!hideDivider && index < items.length - 1 && (
          <View
            testID={`divider-${index}`}
            className="h-[1px] mx-4 bg-border-primary"
          />
        )}
      </React.Fragment>
    ))}
  </View>
);
