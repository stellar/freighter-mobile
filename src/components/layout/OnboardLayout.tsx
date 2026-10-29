/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ScrollableKeyboardView } from "components/layout/ScrollableKeyboardView";
import { Button } from "components/sds/Button";
import { Display, Text } from "components/sds/Typography";
import { DEFAULT_PADDING } from "config/constants";
import { px, pxValue } from "helpers/dimensions";
import useColors from "hooks/useColors";
import useKeyboardVisible from "hooks/useKeyboardVisible";
import useTheme from "hooks/useTheme";
import { t } from "i18next";
import React from "react";
import { StyleSheet, View } from "react-native";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";

/** How a footer note reads: plain help, or a warning in amber. */
export type FooterNoteTone = "secondary" | "warning";

interface OnboardLayoutProps {
  children: React.ReactNode;
  /**
   * The screen's title. Pass a node, set in OnboardTitle, for a title that
   * changes in place, as Recovery Phrase's does.
   */
  title?: React.ReactNode;
  /**
   * Under the title, in secondary text. Pass a node to style part of it,
   * such as a sentence in bold.
   */
  description?: React.ReactNode;
  /**
   * Replaces the default action buttons. Pass null for no footer at all,
   * when a screen's only action sits in its content.
   */
  footer?: React.ReactNode;
  footerNoteText?: string;
  /** "warning" sets the note in amber, as Recovery Phrase's is. */
  footerNoteTone?: FooterNoteTone;
  onPressDefaultActionButton?: () => void | Promise<void>;
  isDefaultActionButtonDisabled?: boolean;
  defaultActionButtonText?: string;
  isLoading?: boolean;
  secondaryActionButtonText?: string;
  isSecondaryActionButtonDisabled?: boolean;
  onPressSecondaryActionButton?: () => void | Promise<void>;
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
  // Grows rather than flexes: it fills the screen when the content is short,
  // and takes the content's height when it isn't, so the scroll view can
  // scroll to it (a small screen with the keyboard up).
  flex-grow: 1;
  justify-content: space-between;
  background-color: ${({ $backgroundColor }: StyledProps) => $backgroundColor};
`;

const StyledContentContainer = styled.View<SurfaceProps>`
  flex-grow: 1;
  background-color: ${({ $backgroundColor }: SurfaceProps) => $backgroundColor};
  // Figma: 16pt between the title block and the content.
  gap: ${px(16)};
`;

const FooterContainer = styled.View<SurfaceProps>`
  // Figma: 32pt from a footer note to the buttons.
  gap: ${px(32)};
  background-color: ${({ $backgroundColor }: SurfaceProps) => $backgroundColor};
`;

const FooterNoteText = styled(Text)`
  text-align: center;
`;

const StyledFooterButtonContainer = styled.View`
  gap: ${px(12)};
`;

const styles = StyleSheet.create({
  // Figma's Heading/Screen: Funnel Sans Medium 32/40 with -1.28 tracking.
  title: { letterSpacing: -1.28 },
});

/** An onboarding screen's title, as OnboardLayout sets a string one. */
export const OnboardTitle: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <Display medium family="funnelSans" style={styles.title}>
    {children}
  </Display>
);

/**
 * The note above the footer's buttons, for a screen that lays out its own
 * footer.
 */
export const FooterNote: React.FC<{ text: string; tone: FooterNoteTone }> = ({
  text,
  tone,
}) => {
  const { themeColors } = useColors();

  if (tone === "warning") {
    return (
      <FooterNoteText sm medium color={themeColors.amber[11]}>
        {text}
      </FooterNoteText>
    );
  }

  return (
    <FooterNoteText sm secondary>
      {text}
    </FooterNoteText>
  );
};

interface DefaultFooterProps {
  onPressDefaultActionButton?: () => void | Promise<void>;
  isDefaultActionButtonDisabled?: boolean;
  defaultActionButtonText?: string;
  secondaryActionButtonText?: string;
  onPressSecondaryActionButton?: () => void | Promise<void>;
  isLoading?: boolean;
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
 */
const DefaultFooter: React.FC<DefaultFooterProps> = ({
  onPressDefaultActionButton,
  isDefaultActionButtonDisabled,
  secondaryActionButtonText,
  isSecondaryActionButtonDisabled,
  onPressSecondaryActionButton,
  defaultActionButtonText = t("onboarding.continue"),
  isLoading,
}) => (
  <StyledFooterButtonContainer>
    <Button
      secondary
      testID="default-action-button"
      isLoading={isLoading}
      onPress={onPressDefaultActionButton}
      disabled={isDefaultActionButtonDisabled}
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
 * @param {React.ReactNode} [props.title] - Optional title: a string set as the screen's title, or a node rendered as given.
 * @param {React.ReactNode} [props.description] - Optional text under the title: a string in secondary text, or a node rendered as given.
 * @param {React.ReactNode} [props.footer] - Optional custom footer component; if not provided, a default action button is rendered. Pass null for no footer at all.
 * @param {string} [props.footerNoteText] - Optional additional text displayed above the footer.
 * @param {FooterNoteTone} [props.footerNoteTone="secondary"] - "warning" sets the footer note in amber.
 * @param {() => void} [props.onPressDefaultActionButton] - Optional callback for the default action button press.
 * @param {boolean} [props.isDefaultActionButtonDisabled] - Optional flag to disable the default action button.
 * @param {string} [props.defaultActionButtonText="Continue"] - Optional text for the default action button.
 * @param {string} [props.secondaryActionButtonText] - Optional text for the secondary action button.
 * @param {() => void} [props.onPressSecondaryActionButton] - Optional callback for the secondary action button press.
 */
export const OnboardLayout = ({
  children,
  title,
  description,
  footer,
  footerNoteText,
  footerNoteTone = "secondary",
  onPressDefaultActionButton,
  isDefaultActionButtonDisabled,
  defaultActionButtonText,
  isLoading,
  secondaryActionButtonText,
  isSecondaryActionButtonDisabled,
  onPressSecondaryActionButton,
}: OnboardLayoutProps) => {
  const insets = useSafeAreaInsets();
  const isKeyboardVisible = useKeyboardVisible();
  const theme = useTheme();
  const backgroundColor = theme.colors.base.primary;

  return (
    <ScrollableKeyboardView
      scrollViewProps={{
        // Grows with the content rather than squeezing it to the screen.
        contentContainerStyle: { flexGrow: 1, backgroundColor },
      }}
    >
      <StyledContainer
        testID="onboard-layout"
        $insets={insets}
        $isKeyboardVisible={isKeyboardVisible}
        $backgroundColor={backgroundColor}
      >
        <StyledContentContainer
          testID="onboard-layout-content"
          $backgroundColor={backgroundColor}
        >
          {(title || description) && (
            <View className="gap-[8px]">
              {title &&
                (typeof title === "string" ? (
                  <OnboardTitle>{title}</OnboardTitle>
                ) : (
                  title
                ))}
              {typeof description === "string" ? (
                <Text md secondary>
                  {description}
                </Text>
              ) : (
                description
              )}
            </View>
          )}
          {children}
        </StyledContentContainer>
        {footer !== null && (
          <FooterContainer $backgroundColor={backgroundColor}>
            {footerNoteText && (
              <FooterNote text={footerNoteText} tone={footerNoteTone} />
            )}
            {footer ?? (
              <DefaultFooter
                onPressDefaultActionButton={onPressDefaultActionButton}
                isDefaultActionButtonDisabled={isDefaultActionButtonDisabled}
                defaultActionButtonText={defaultActionButtonText}
                secondaryActionButtonText={secondaryActionButtonText}
                onPressSecondaryActionButton={onPressSecondaryActionButton}
                isLoading={isLoading}
                isSecondaryActionButtonDisabled={
                  isSecondaryActionButtonDisabled
                }
              />
            )}
          </FooterContainer>
        )}
      </StyledContainer>
    </ScrollableKeyboardView>
  );
};
