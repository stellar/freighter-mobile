/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import useTheme from "hooks/useTheme";
import React, { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  KeyboardAvoidingViewProps,
  ScrollViewProps,
} from "react-native";
import styled from "styled-components/native";

interface SurfaceProps {
  $backgroundColor: string;
}

const StyledKeyboardAvoidingView = styled(KeyboardAvoidingView).attrs(
  (props: KeyboardAvoidingViewProps & SurfaceProps) => ({
    behavior: Platform.select({
      ios: "padding",
      android: "padding",
    }),
    contentContainerStyle: {
      flex: 1,
      backgroundColor: props.$backgroundColor,
    },
    ...props,
  }),
)<SurfaceProps>`
  flex: 1;
  background-color: ${({ $backgroundColor }: SurfaceProps) => $backgroundColor};
`;

const StyledScrollView = styled(ScrollView).attrs(
  (props: ScrollViewProps & SurfaceProps) =>
    ({
      keyboardShouldPersistTaps: "handled",
      showsVerticalScrollIndicator: false,
      alwaysBounceVertical: false,
      contentContainerStyle: {
        flex: 1,
        backgroundColor: props.$backgroundColor,
      },
      ...props,
    }) as ScrollViewProps,
)<SurfaceProps>`
  flex-grow: 1;
  background-color: ${({ $backgroundColor }: SurfaceProps) => $backgroundColor};
`;

interface ScrollableKeyboardViewProps {
  children: ReactNode;
  keyboardAvoidingViewProps?: Partial<KeyboardAvoidingViewProps>;
  scrollViewProps?: Partial<ScrollViewProps>;
}

/**
 * A component that combines KeyboardAvoidingView and ScrollView with proper styling
 * and keyboard handling for both iOS and Android platforms.
 */
export const ScrollableKeyboardView: React.FC<ScrollableKeyboardViewProps> = ({
  children,
  keyboardAvoidingViewProps,
  scrollViewProps,
}) => {
  const theme = useTheme();
  const backgroundColor = theme.colors.base.primary;

  return (
    <StyledKeyboardAvoidingView
      $backgroundColor={backgroundColor}
      {...keyboardAvoidingViewProps}
    >
      <StyledScrollView $backgroundColor={backgroundColor} {...scrollViewProps}>
        {children}
      </StyledScrollView>
    </StyledKeyboardAvoidingView>
  );
};
