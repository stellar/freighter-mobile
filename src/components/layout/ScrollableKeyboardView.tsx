/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { THEME } from "config/theme";
import React, { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  KeyboardAvoidingViewProps,
  ScrollViewProps,
} from "react-native";
import styled from "styled-components/native";

const StyledKeyboardAvoidingView = styled(KeyboardAvoidingView).attrs(
  (props: KeyboardAvoidingViewProps) => ({
    behavior: Platform.select({
      ios: "padding",
      android: undefined,
    }),
    contentContainerStyle: {
      flex: 1,
      backgroundColor: THEME.colors.background.default,
    },
    ...props,
  }),
)`
  flex: 1;
  background-color: ${THEME.colors.background.default};
`;

const StyledScrollView = styled(ScrollView).attrs(
  (props: ScrollViewProps) =>
    ({
      keyboardShouldPersistTaps: "never",
      showsVerticalScrollIndicator: false,
      alwaysBounceVertical: false,
      contentContainerStyle: {
        flex: 1,
        backgroundColor: THEME.colors.background.default,
      },
      ...props,
    }) as ScrollViewProps,
)`
  flex-grow: 1;
  background-color: ${THEME.colors.background.default};
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
}) => (
  <StyledKeyboardAvoidingView {...keyboardAvoidingViewProps}>
    <StyledScrollView {...scrollViewProps}>{children}</StyledScrollView>
  </StyledKeyboardAvoidingView>
);
