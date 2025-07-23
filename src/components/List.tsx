import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import React from "react";
import { View, TouchableOpacity } from "react-native";

interface ListItemProps {
  icon?: React.ReactNode;
  key?: string;
  title: string;
  titleColor?: string;
  description?: string;
  descriptionColor?: string;
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
      <React.Fragment key={item.key || item.title}>
        <TouchableOpacity
          disabled={!item.onPress}
          onPress={item.onPress}
          testID={item.testID}
          className={`flex-row gap-3 ${compact ? "py-2" : "p-4"} ${
            item.description ? "items-start" : "items-center"
          }`}
        >
          {item.icon && (
            <View className={item.description ? "mt-1" : ""}>{item.icon}</View>
          )}
          <View className="flex-1">
            <Text
              md
              semiBold
              color={item.titleColor || THEME.colors.text.primary}
            >
              {item.title}
            </Text>
            {item.description && (
              <View className="mt-4">
                <Text
                  sm
                  secondary
                  color={item.descriptionColor || THEME.colors.text.secondary}
                >
                  {item.description}
                </Text>
              </View>
            )}
          </View>
          {item.trailingContent && (
            <View className={item.description ? "mt-1" : ""}>
              {item.trailingContent}
            </View>
          )}
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
