import { Text } from "components/sds/Typography";
import { DEFAULT_PRESS_DELAY } from "config/constants";
import { THEME } from "config/theme";
import React from "react";
import { View, TouchableOpacity } from "react-native";

export interface ListItemProps {
  icon?: React.ReactNode;
  key?: string;
  title?: string;
  titleComponent?: React.ReactNode;
  titleColor?: string;
  description?: string;
  descriptionColor?: string;
  trailingContent?: React.ReactNode;
  onPress?: () => void;
  testID?: string;
}

interface ListProps {
  items: ListItemProps[];
  variant?: "filled" | "transparent" | "secondary";
  className?: string;
  hideDivider?: boolean;
  compact?: boolean;
}

const getContainerStyles = (variant: ListProps["variant"]) => {
  switch (variant) {
    case "filled":
      return "bg-background-secondary rounded-[12px]";
    case "transparent":
      return "";
    case "secondary":
      return "bg-background-tertiary rounded-[16px]";
    default:
      return "";
  }
};

const getTextStyles = (variant: ListProps["variant"]) => {
  switch (variant) {
    case "secondary":
      return { md: true, medium: true };
    default:
      return { sm: true, semiBold: true };
  }
};

export const List: React.FC<ListProps> = ({
  items,
  variant = "filled",
  className,
  hideDivider = false,
  compact = false,
}) => (
  <View className={`${getContainerStyles(variant)} ${className}`}>
    {items.map((item, index) => (
      <React.Fragment key={item.key || item.title || `list-item-${index}`}>
        <TouchableOpacity
          disabled={!item.onPress}
          onPress={item.onPress}
          delayPressIn={DEFAULT_PRESS_DELAY}
          testID={item.testID}
          className={`flex-row gap-3 ${compact ? "py-2" : "p-4"} ${
            item.description ? "items-start" : "items-center"
          }`}
        >
          {item.icon && (
            <View className={item.description ? "mt-1" : ""}>{item.icon}</View>
          )}
          <View className="flex-1">
            {item.titleComponent ? (
              item.titleComponent
            ) : (
              <Text
                {...getTextStyles(variant)}
                color={item.titleColor || THEME.colors.text.primary}
              >
                {item.title}
              </Text>
            )}
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
