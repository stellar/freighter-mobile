/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ScrollableKeyboardView } from "components/layout/ScrollableKeyboardView";
import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { px, pxValue } from "helpers/dimensions";
import useKeyboardVisible from "hooks/useKeyboardVisible";
import useTheme from "hooks/useTheme";
import { t } from "i18next";
import React from "react";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";

interface OnboardLayoutProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
  footer?: React.ReactNode;
  footerNoteText?: string;
  onPressDefaultActionButton?: () => void | Promise<void>;
  isDefaultActionButtonDisabled?: boolean;
  defaultActionButtonText?: string;
  hasClipboardButton?: boolean;
  onPressClipboardButton?: () => Promise<void>;
  isLoading?: boolean;
  secondaryActionButtonText?: string;
  isSecondaryActionButtonDisabled?: boolean;
  onPressSecondaryActionButton?: () => void | Promise<void>;
  defaultActionButtonIcon?: React.ReactNode;
  defaultActionButtonIconPosition?: IconPosition;
}

interface SurfaceProps {
  $backgroundColor: string;
}

interface StyledProps extends SurfaceProps {
  $insets: EdgeInsets;
  $isKeyboardVisible: boolean;
}

const StyledContainer = styled.View<StyledProps>`
  padding-left: ${px(24)};
  padding-right: ${px(24)};
  padding-bottom: ${({ $insets, $isKeyboardVisible }: StyledProps) =>
    // Use fixed DEFAULT_PADDING when keyboard is visible for consistent spacing across platforms
    $isKeyboardVisible
      ? pxValue(DEFAULT_PADDING)
      : $insets.bottom + pxValue(DEFAULT_PADDING)}px;
  flex: 1;
  justify-content: space-between;
  background-color: ${({ $backgroundColor }: StyledProps) => $backgroundColor};
`;

const StyledContentContainer = styled.View<SurfaceProps>`
  flex: 1;
  background-color: ${({ $backgroundColor }: SurfaceProps) => $backgroundColor};
  gap: ${px(24)};
`;

const FooterContainer = styled.View<SurfaceProps>`
  gap: ${px(24)};
  background-color: ${({ $backgroundColor }: SurfaceProps) => $backgroundColor};
`;

const FooterNoteText = styled(Text)`
  text-align: center;
`;

const StyledFooterButtonContainer = styled.View`
  gap: ${px(12)};
`;

interface DefaultFooterProps {
  onPressDefaultActionButton?: () => void | Promise<void>;
  isDefaultActionButtonDisabled?: boolean;
  defaultActionButtonText?: string;
  secondaryActionButtonText?: string;
  onPressSecondaryActionButton?: () => void | Promise<void>;
  hasClipboardButton?: boolean;
  onPressClipboardButton?: () => Promise<void>;
  isLoading?: boolean;
  defaultActionButtonIcon?: React.ReactNode;
  defaultActionButtonIconPosition?: IconPosition;
  isSecondaryActionButtonDisabled?: boolean;
}

/**
 * DefaultFooter component renders the default action button used in the OnboardLayout.
 *
 * @example
 * <DefaultFooter
 *   onPressDefaultActionButton={() => console.log("Button pressed")}
 *   isDefaultActionButtonDisabled={false}
 *   defaultActionButtonText="Get Started"
 * />
 *
 * @param {DefaultFooterProps} props - The component props.
 * @param {() => void} [props.onPressDefaultActionButton] - Callback when the action button is pressed.
 * @param {boolean} [props.isDefaultActionButtonDisabled] - Flag to disable the action button.
 * @param {string} [props.defaultActionButtonText="Continue"] - Text to display on the action button.
 * @param {string} [props.secondaryActionButtonText] - Optional text for the secondary action button.
 * @param {() => void} [props.onPressSecondaryActionButton] - Optional callback for the secondary action button press.
 * @param {boolean} [props.hasClipboardButton] - Flag to display a clipboard button in the footer.
 * @param {() => void} [props.onPressClipboardButton] - Callback when the clipboard button is pressed.
 * @param {React.ReactNode} [props.defaultActionButtonIcon] - Optional icon for the action button.
 * @param {IconPosition} [props.defaultActionButtonIconPosition] - Optional position for the action button icon.
 */
const DefaultFooter: React.FC<DefaultFooterProps> = ({
  onPressDefaultActionButton,
  isDefaultActionButtonDisabled,
  secondaryActionButtonText,
  isSecondaryActionButtonDisabled,
  onPressSecondaryActionButton,
  defaultActionButtonText = t("onboarding.continue"),
  hasClipboardButton = false,
  onPressClipboardButton,
  isLoading,
  defaultActionButtonIcon,
  defaultActionButtonIconPosition,
}) => (
  <StyledFooterButtonContainer>
    {hasClipboardButton && (
      <Button
        tertiary
        isFullWidth
        testID="clipboard-button"
        onPress={onPressClipboardButton as () => void}
        icon={<Icon.Clipboard size={16} />}
      >
        {t("onboarding.pasteFromClipboard")}
      </Button>
    )}
    <Button
      secondary
      testID="default-action-button"
      isLoading={isLoading}
      onPress={onPressDefaultActionButton}
      disabled={isDefaultActionButtonDisabled}
      icon={defaultActionButtonIcon}
      iconPosition={defaultActionButtonIconPosition}
    >
      {defaultActionButtonText}
    </Button>
    {secondaryActionButtonText && (
      <Button
        tertiary
        disabled={isLoading || isSecondaryActionButtonDisabled}
        testID="tertiary-action-button"
        onPress={onPressSecondaryActionButton}
      >
        {secondaryActionButtonText}
      </Button>
    )}
  </StyledFooterButtonContainer>
);

/**
 * OnboardLayout component provides a layout for onboarding screens with structured header, content, and footer sections.
 *
 * @example
 * Basic usage:
 * ```tsx
 * <OnboardLayout
 *   icon={<Icon.SomeIcon />}
 *   title="Welcome"
 *   onPressDefaultActionButton={() => console.log("Continue pressed")}
 *   defaultActionButtonText="Get Started"
 * >
 *   <Text>Your onboarding content goes here.</Text>
 * </OnboardLayout>
 * ```
 *
 * @param {OnboardLayoutProps} props - The component props.
 * @param {React.ReactNode} props.children - The main content to be rendered within the layout.
 * @param {React.ReactNode} [props.icon] - Optional icon component displayed at the top.
 * @param {string} [props.title] - Optional title text displayed in the header.
 * @param {React.ReactNode} [props.footer] - Optional custom footer component; if not provided, a default action button is rendered.
 * @param {string} [props.footerNoteText] - Optional additional text displayed above the footer.
 * @param {() => void} [props.onPressDefaultActionButton] - Optional callback for the default action button press.
 * @param {boolean} [props.isDefaultActionButtonDisabled] - Optional flag to disable the default action button.
 * @param {string} [props.defaultActionButtonText="Continue"] - Optional text for the default action button.
 * @param {boolean} [props.hasClipboardButton] - Optional flag to display a clipboard button in the footer.
 * @param {() => Promise<void>} [props.onPressClipboardButton] - Optional callback for the clipboard button press.
 * @param {string} [props.secondaryActionButtonText] - Optional text for the secondary action button.
 * @param {() => void} [props.onPressSecondaryActionButton] - Optional callback for the secondary action button press.
 */
export const OnboardLayout = ({
  children,
  icon,
  title,
  footer,
  footerNoteText,
  onPressDefaultActionButton,
  isDefaultActionButtonDisabled,
  defaultActionButtonText,
  hasClipboardButton,
  onPressClipboardButton,
  isLoading,
  secondaryActionButtonText,
  isSecondaryActionButtonDisabled,
  onPressSecondaryActionButton,
  defaultActionButtonIcon,
  defaultActionButtonIconPosition,
}: OnboardLayoutProps) => {
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardVisible();
  const theme = useTheme();
  const backgroundColor = theme.colors.base.primary;

  return (
    <ScrollableKeyboardView>
      <StyledContainer
        $insets={insets}
        $isKeyboardVisible={isKeyboardVisible}
        $backgroundColor={backgroundColor}
      >
        <StyledContentContainer $backgroundColor={backgroundColor}>
          {icon}
          {title && <Display medium>{title}</Display>}
          {children}
        </StyledContentContainer>
        <FooterContainer $backgroundColor={backgroundColor}>
          {footerNoteText && (
            <FooterNoteText sm secondary>
              {footerNoteText}
            </FooterNoteText>
          )}
          {footer || (
            <DefaultFooter
              onPressDefaultActionButton={onPressDefaultActionButton}
              isDefaultActionButtonDisabled={isDefaultActionButtonDisabled}
              defaultActionButtonText={defaultActionButtonText}
              secondaryActionButtonText={secondaryActionButtonText}
              onPressSecondaryActionButton={onPressSecondaryActionButton}
              hasClipboardButton={hasClipboardButton}
              onPressClipboardButton={onPressClipboardButton}
              isLoading={isLoading}
              defaultActionButtonIcon={defaultActionButtonIcon}
              defaultActionButtonIconPosition={defaultActionButtonIconPosition}
              isSecondaryActionButtonDisabled={isSecondaryActionButtonDisabled}
            />
          )}
        </FooterContainer>
      </StyledContainer>
    </ScrollableKeyboardView>
  );
};
