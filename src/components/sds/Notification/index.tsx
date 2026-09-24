import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { NotificationVariants, SHADOW_COLOR } from "config/theme";
import { px } from "helpers/dimensions";
import useNotificationVariants from "hooks/useNotificationVariants";
import useTheme from "hooks/useTheme";
import React from "react";
import { TouchableOpacity, View } from "react-native";
import styled from "styled-components/native";

/** Available notification variants */
export type NotificationVariant = keyof NotificationVariants;

export interface NotificationProps {
  /** Variant of the notification */
  variant: NotificationVariant;
  /** Notification title */
  title?: string;
  /** Notification icon @defaultValue `<Icon.InfoCircle />` */
  icon?: React.ReactNode;
  /** Notification message */
  message?: string | React.ReactNode;
  /** Whether to show filled background */
  isFilled?: boolean;
  /** Custom content to render instead of title and message */
  customContent?: React.ReactNode;
  /** Optional onPress handler to make the notification interactive */
  onPress?: () => void;
  /** Optional accessibility label for non-string or custom content */
  accessibilityLabel?: string;
}

interface SurfaceProps {
  $backgroundColor: string;
  $borderColor: string;
}

const NotificationContentContainer = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: ${px(8)};
  width: 100%;
`;

const IconContainer = styled.View`
  width: ${px(16)};
  height: ${px(16)};
  margin-top: ${px(2)};
  flex-shrink: 0;
`;

const CustomContentContainer = styled.View`
  flex: 1;
`;

const NotificationWrapper = styled.View`
  width: 100%;
`;

const NotificationContainer = styled(View)<SurfaceProps>`
  background-color: ${({ $backgroundColor }: SurfaceProps) => $backgroundColor};
  border: ${px(1)} solid ${({ $borderColor }: SurfaceProps) => $borderColor};
  border-radius: ${px(8)};
  padding: ${px(12)};
  flex-direction: column;
  gap: ${px(8)};
  width: 100%;
  shadow-color: ${SHADOW_COLOR};
  shadow-offset: 0 ${px(2)};
  shadow-opacity: 0.25;
  shadow-radius: ${px(3.84)};
  elevation: 5;
`;

/**
 * Notification component for displaying permanent notification-style messages.
 * Can be used for both static notifications and interactive ones with onPress handler.
 *
 * @example
 * // Basic usage with title and message
 * <Notification
 *   variant="success"
 *   title="Important Information"
 *   message="This is a permanent notification message."
 * />
 *
 * // Using custom content
 * <Notification
 *   variant="success"
 *   customContent={
 *     <View>
 *       <Text sm>Custom styled text here</Text>
 *       <Text sm semiBold>More text with different style</Text>
 *     </View>
 *   }
 * />
 *
 * // With onPress handler
 * <Notification
 *   variant="primary"
 *   message="Click me to perform an action"
 *   onPress={() => console.log('Notification pressed')}
 * />
 */
export const Notification: React.FC<NotificationProps> = ({
  variant,
  title,
  icon,
  message,
  isFilled = false,
  customContent,
  onPress,
  accessibilityLabel,
}) => {
  const variants = useNotificationVariants();
  const theme = useTheme();
  const backgroundColor = isFilled
    ? variants[variant].backgroundColor
    : theme.colors.background.default;

  const computedAccessibilityLabel =
    accessibilityLabel ||
    title ||
    (typeof message === "string" ? message : undefined);
  const content = (
    <NotificationContainer
      $backgroundColor={backgroundColor}
      $borderColor={theme.colors.border.default}
    >
      <NotificationContentContainer>
        <IconContainer>
          {icon || (
            <Icon.InfoCircle size={16} color={variants[variant].iconColor} />
          )}
        </IconContainer>
        <CustomContentContainer>
          {customContent || (
            <>
              {title && (
                <Text sm semiBold>
                  {title}
                </Text>
              )}
              {message &&
                (typeof message === "string" ? (
                  <Text sm secondary>
                    {message}
                  </Text>
                ) : (
                  message
                ))}
            </>
          )}
        </CustomContentContainer>
      </NotificationContentContainer>
    </NotificationContainer>
  );

  return (
    <NotificationWrapper>
      {onPress ? (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={computedAccessibilityLabel}
        >
          {content}
        </TouchableOpacity>
      ) : (
        <View
          accessibilityRole="alert"
          accessibilityLabel={computedAccessibilityLabel}
        >
          {content}
        </View>
      )}
    </NotificationWrapper>
  );
};
