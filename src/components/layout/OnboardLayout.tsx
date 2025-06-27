/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ScrollableKeyboardView } from "components/ScrollableKeyboardView";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { PALETTE, THEME } from "config/theme";
import { px, pxValue } from "helpers/dimensions";
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
  onPressDefaultActionButton?: () => void;
  isDefaultActionButtonDisabled?: boolean;
  defaultActionButtonText?: string;
  hasClipboardButton?: boolean;
  onPressClipboardButton?: () => Promise<void>;
  isLoading?: boolean;
}

interface StyledProps {
  $insets: EdgeInsets;
}

const StyledContainer = styled.View<StyledProps>`
  padding-left: ${px(24)};
  padding-right: ${px(24)};
  padding-bottom: ${({ $insets }: StyledProps) =>
    pxValue($insets.bottom + DEFAULT_PADDING)};
  flex: 1;
  justify-content: space-between;
  background-color: ${THEME.colors.background.default};
`;

const StyledContentContainer = styled.View`
  flex: 1;
  background-color: ${THEME.colors.background.default};
  gap: ${px(24)};
`;

const FooterContainer = styled.View`
  gap: ${px(24)};
  background-color: ${THEME.colors.background.default};
`;

const FooterNoteText = styled(Text)`
  text-align: center;
`;

const StyledFooterButtonContainer = styled.View`
  gap: ${px(12)};
`;

interface DefaultFooterProps {
  onPressDefaultActionButton?: () => void;
  isDefaultActionButtonDisabled?: boolean;
  defaultActionButtonText?: string;
  hasClipboardButton?: boolean;
  onPressClipboardButton?: () => Promise<void>;
  isLoading?: boolean;
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
 * @param {boolean} [props.hasClipboardButton] - Flag to display a clipboard button in the footer.
 * @param {() => void} [props.onPressClipboardButton] - Callback when the clipboard button is pressed.
 */
const DefaultFooter: React.FC<DefaultFooterProps> = ({
  onPressDefaultActionButton,
  isDefaultActionButtonDisabled,
  defaultActionButtonText = t("onboarding.continue"),
  hasClipboardButton = false,
  onPressClipboardButton,
  isLoading,
}) => (
  <StyledFooterButtonContainer>
    {hasClipboardButton && (
      <Button
        secondary
        lg
        isFullWidth
        testID="clipboard-button"
        onPress={onPressClipboardButton as () => void}
        icon={<Icon.Clipboard size={16} color={PALETTE.dark.gray["09"]} />}
      >
        {t("onboarding.pasteFromClipboard")}
      </Button>
    )}
    <Button
      tertiary
      lg
      testID="default-action-button"
      isLoading={isLoading}
      onPress={onPressDefaultActionButton}
      disabled={isDefaultActionButtonDisabled}
    >
      {defaultActionButtonText}
    </Button>
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
}: OnboardLayoutProps) => {
  const insets = useSafeAreaInsets();

  return (
    <ScrollableKeyboardView>
      <StyledContainer $insets={insets}>
        <StyledContentContainer>
          {icon}
          {title && <Display medium>{title}</Display>}
          {children}
        </StyledContentContainer>
        <FooterContainer>
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
              hasClipboardButton={hasClipboardButton}
              onPressClipboardButton={onPressClipboardButton}
              isLoading={isLoading}
            />
          )}
        </FooterContainer>
      </StyledContainer>
    </ScrollableKeyboardView>
  );
};
