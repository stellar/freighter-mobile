/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { THEME } from "config/theme";
import React from "react";
import {
  KeyboardAvoidingView,
  KeyboardAvoidingViewProps,
  ScrollView,
  ScrollViewProps,
  Platform,
} from "react-native";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";

interface BaseLayoutProps {
  children: React.ReactNode;
  useSafeArea?: boolean;
  backgroundColor?: string;
  useKeyboardAvoidingView?: boolean;
}

interface StyledViewProps {
  $backgroundColor: string;
  $insets: EdgeInsets;
}

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

const StyledSafeAreaView = styled.View<StyledViewProps>`
  flex: 1;
  background-color: ${({ $backgroundColor }: StyledViewProps) =>
    $backgroundColor};
  padding-top: ${({ $insets }: StyledViewProps) => $insets.top}px;
  padding-bottom: ${({ $insets }: StyledViewProps) => $insets.bottom}px;
  padding-left: ${({ $insets }: StyledViewProps) => $insets.left}px;
  padding-right: ${({ $insets }: StyledViewProps) => $insets.right}px;
`;

const StyledView = styled.View<StyledViewProps>`
  flex: 1;
  background-color: ${({ $backgroundColor }: StyledViewProps) =>
    $backgroundColor};
`;

export const BaseLayout = ({
  children,
  useSafeArea = true,
  useKeyboardAvoidingView = false,
  backgroundColor = THEME.colors.background.default,
}: BaseLayoutProps) => {
  const insets = useSafeAreaInsets();
  const Container = useSafeArea ? StyledSafeAreaView : StyledView;

  if (useKeyboardAvoidingView) {
    return (
      <StyledKeyboardAvoidingView>
        <StyledScrollView>
          <Container $insets={insets} $backgroundColor={backgroundColor}>
            {children}
          </Container>
        </StyledScrollView>
      </StyledKeyboardAvoidingView>
    );
  }

  return (
    <Container $insets={insets} $backgroundColor={backgroundColor}>
      {children}
    </Container>
  );
};
