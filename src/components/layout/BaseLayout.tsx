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
}

interface StyledViewProps {
  $backgroundColor: string;
  $insets: EdgeInsets;
}

const StyledSafeAreaView = styled.View<StyledViewProps>`
  flex: 1;
  background-color: ${({ $backgroundColor }: StyledViewProps) =>
    $backgroundColor};
  padding-top: ${({ $insets }: StyledViewProps) => $insets.top}px;
  padding-left: ${({ $insets }: StyledViewProps) =>
    $insets.left + DEFAULT_PADDING}px;
  padding-right: ${({ $insets }: StyledViewProps) =>
    $insets.right + DEFAULT_PADDING}px;
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
      <ScrollableKeyboardView>
        <Container $insets={insets} $backgroundColor={backgroundColor}>
          {children}
        </Container>
      </ScrollableKeyboardView>
    );
  }

  return (
    <Container $insets={insets} $backgroundColor={backgroundColor}>
      {children}
    </Container>
  );
};
