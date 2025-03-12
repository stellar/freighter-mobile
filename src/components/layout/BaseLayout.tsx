import { THEME } from "config/theme";
import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import styled from "styled-components/native";

interface BaseLayoutProps {
  children: React.ReactNode;
  useSafeArea?: boolean;
  backgroundColor?: string;
}

interface StyledViewProps {
  backgroundColor: string;
}

const StyledSafeAreaView = styled(SafeAreaView)<StyledViewProps>`
  flex: 1;
  background-color: ${({ backgroundColor }: StyledViewProps) =>
    backgroundColor};
`;

const StyledView = styled(View)<StyledViewProps>`
  flex: 1;
  background-color: ${({ backgroundColor }: StyledViewProps) =>
    backgroundColor};
`;

export const BaseLayout = ({
  children,
  useSafeArea = true,
  backgroundColor = THEME.colors.background.default,
}: BaseLayoutProps) => {
  const Container = useSafeArea ? StyledSafeAreaView : StyledView;

  return <Container backgroundColor={backgroundColor}>{children}</Container>;
};
