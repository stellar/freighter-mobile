/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ScrollableKeyboardView } from "components/ScrollableKeyboardView";
import { DEFAULT_PADDING } from "config/constants";
import { THEME } from "config/theme";
import React from "react";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";

interface BaseLayoutProps {
  children: React.ReactNode;
  useSafeArea?: boolean;
  backgroundColor?: string;
  useKeyboardAvoidingView?: boolean;
  insets?: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

interface StyledViewProps {
  $backgroundColor: string;
  $insets: EdgeInsets;
  $insetsConfig?: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

const StyledSafeAreaView = styled.View<StyledViewProps>`
  flex: 1;
  background-color: ${({ $backgroundColor }: StyledViewProps) =>
    $backgroundColor};
  padding-top: ${({ $insets, $insetsConfig }: StyledViewProps) =>
    $insetsConfig?.top ? $insets.top : 0}px;
  padding-right: ${({ $insets, $insetsConfig }: StyledViewProps) =>
    ($insetsConfig?.right ? $insets.right : 0) + DEFAULT_PADDING}px;
  padding-bottom: ${({ $insets, $insetsConfig }: StyledViewProps) =>
    $insetsConfig?.bottom ? $insets.bottom : 0}px;
  padding-left: ${({ $insets, $insetsConfig }: StyledViewProps) =>
    ($insetsConfig?.left ? $insets.left : 0) + DEFAULT_PADDING}px;
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
  insets = {
    top: true,
    right: true,
    bottom: true,
    left: true,
  },
}: BaseLayoutProps) => {
  const safeAreaInsets = useSafeAreaInsets();
  const Container = useSafeArea ? StyledSafeAreaView : StyledView;

  if (useKeyboardAvoidingView) {
    return (
      <ScrollableKeyboardView>
        <Container
          $insets={safeAreaInsets}
          $backgroundColor={backgroundColor}
          $insetsConfig={insets}
        >
          {children}
        </Container>
      </ScrollableKeyboardView>
    );
  }

  return (
    <Container
      $insets={safeAreaInsets}
      $backgroundColor={backgroundColor}
      $insetsConfig={insets}
    >
      {children}
    </Container>
  );
};
