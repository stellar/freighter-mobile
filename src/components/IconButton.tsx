import { IconProps } from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { px } from "helpers/dimensions";
import React from "react";
import { TouchableOpacity } from "react-native";
import styled from "styled-components/native";

const CIRCLE_SIZE = 56;

const ButtonContainer = styled.View<{ disabled?: boolean }>`
  align-items: center;
  opacity: ${({ disabled }: { disabled?: boolean }) =>
    disabled ? THEME.opacity.disabled : 1};
`;

const IconWrapper = styled(TouchableOpacity)`
  width: ${px(CIRCLE_SIZE)};
  height: ${px(CIRCLE_SIZE)};
  border-radius: ${px(CIRCLE_SIZE)};
  border-width: ${px(1)};
  border-color: ${THEME.colors.border.default};
  background-color: ${THEME.colors.background.tertiary};
  justify-content: center;
  align-items: center;
  margin-bottom: ${px(12)};
`;

interface IconButtonProps {
  Icon: React.FC<IconProps>;
  title: string;
  onPress?: () => void;
  disabled?: boolean;
}

/**
 * IconButton Component
 *
 * A circular button with an icon and title, commonly used for navigation or actions.
 * The button becomes disabled when either the disabled prop is true or onPress is not provided.
 *
 * @example
 * // Basic usage
 * <IconButton
 *   Icon={Icon.Home02}
 *   title="Home"
 *   onPress={() => console.log('Pressed')}
 * />
 *
 * @example
 * // Disabled state
 * <IconButton
 *   Icon={Icon.Settings}
 *   title="Settings"
 *   disabled={true}
 * />
 *
 * @example
 * // Without onPress (automatically disabled)
 * <IconButton
 *   Icon={Icon.Info}
 *   title="Info"
 * />
 *
 * @param {Object} props - Component props
 * @param {React.FC<IconProps>} props.Icon - The icon component to display
 * @param {string} props.title - Text to display below the icon
 * @param {() => void} [props.onPress] - Function to call when button is pressed
 * @param {boolean} [props.disabled=false] - Whether the button is disabled
 */
export const IconButton: React.FC<IconButtonProps> = ({
  Icon,
  title,
  onPress,
  disabled = false,
}) => {
  const isDisabled = disabled || !onPress;

  return (
    <ButtonContainer disabled={isDisabled} testID="icon-button-container">
      <IconWrapper onPress={onPress} disabled={isDisabled} testID="icon-button">
        <Icon size={24} color={THEME.colors.text.primary} />
      </IconWrapper>
      <Text md medium secondary>
        {title}
      </Text>
    </ButtonContainer>
  );
};
