/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { ScrollableKeyboardView } from "components/ScrollableKeyboardView";
import { DEFAULT_PADDING } from "config/constants";
import { THEME } from "config/theme";
import { calculateEdgeSpacing } from "helpers/dimensions";
import React from "react";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";

export type BaseLayoutInsets = {
  top?: boolean;
  right?: boolean;
  bottom?: boolean;
  left?: boolean;
};

interface BaseLayoutProps {
  children: React.ReactNode;
  useSafeArea?: boolean;
  backgroundColor?: string;
  useKeyboardAvoidingView?: boolean;
  insets?: BaseLayoutInsets;
}

interface StyledViewProps {
  $backgroundColor: string;
  $insets: EdgeInsets;
  $insetsConfig?: {
    top?: boolean;
    right?: boolean;
    bottom?: boolean;
    left?: boolean;
  };
}

const StyledSafeAreaView = styled.View<StyledViewProps>`
  flex: 1;
  background-color: ${({ $backgroundColor }: StyledViewProps) =>
    $backgroundColor};
  padding-top: ${({ $insets, $insetsConfig }: StyledViewProps) => {
    if (!$insetsConfig?.top) return 0;
    return calculateEdgeSpacing($insets.top, { toNumber: true });
  }}px;
  padding-right: ${({ $insets, $insetsConfig }: StyledViewProps) => {
    if (!$insetsConfig?.right) return 0;
    return $insets.right + DEFAULT_PADDING;
  }}px;
  padding-bottom: ${({ $insets, $insetsConfig }: StyledViewProps) => {
    if (!$insetsConfig?.bottom) return 0;
    return calculateEdgeSpacing($insets.bottom, { toNumber: true });
  }}px;
  padding-left: ${({ $insets, $insetsConfig }: StyledViewProps) => {
    if (!$insetsConfig?.left) return 0;
    return $insets.left + DEFAULT_PADDING;
  }}px;
`;

const StyledView = styled.View<StyledViewProps>`
  flex: 1;
  background-color: ${({ $backgroundColor }: StyledViewProps) =>
    $backgroundColor};
`;

const DEFAULT_INSETS = {
  top: true,
  right: true,
  bottom: true,
  left: true,
};

export const BaseLayout = ({
  children,
  useSafeArea = true,
  useKeyboardAvoidingView = false,
  backgroundColor = THEME.colors.background.default,
  insets = DEFAULT_INSETS,
}: BaseLayoutProps) => {
  const safeAreaInsets = useSafeAreaInsets();
  const Container = useSafeArea ? StyledSafeAreaView : StyledView;

  // Merge provided insets with defaults to maintain default values for unspecified props
  const mergedInsets = { ...DEFAULT_INSETS, ...insets };

  if (useKeyboardAvoidingView) {
    return (
      <ScrollableKeyboardView>
        <Container
          $insets={safeAreaInsets}
          $backgroundColor={backgroundColor}
          $insetsConfig={mergedInsets}
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
      $insetsConfig={mergedInsets}
    >
      {children}
    </Container>
  );
};
