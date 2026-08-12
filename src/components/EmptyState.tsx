import { IconProps } from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

const ICON_SIZE = 24;

interface EmptyStateProps {
  Icon: React.FC<IconProps>;
  title: string;
  /** Supports nested Text spans for emphasized words or inline links. */
  description?: React.ReactNode;
  /** Optional action rendered under the text block (e.g. a fund button). */
  children?: React.ReactNode;
  testID?: string;
}

/**
 * Centered empty-state block for the Home tabs: a circled icon over a title,
 * an optional description, and an optional action underneath.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  Icon: IconComponent,
  title,
  description,
  children,
  testID,
}) => {
  const { themeColors } = useColors();

  return (
    <View className="items-center gap-6 px-8 py-10" testID={testID}>
      <View className="items-center gap-3 w-full">
        <View className="bg-background-tertiary rounded-full p-4">
          <IconComponent
            size={ICON_SIZE}
            color={themeColors.foreground.primary}
          />
        </View>
        <Text lg medium primary textAlign="center">
          {title}
        </Text>
        {description ? (
          <Text sm secondary textAlign="center">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
};

export default EmptyState;
