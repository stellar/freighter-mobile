import { BaseLayout } from "components/layout/BaseLayout";
import { THEME } from "config/theme";
import React from "react";
import { ActivityIndicator } from "react-native";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
`;

export const LoadingScreen: React.FC = () => (
  <BaseLayout useSafeArea>
    <Container>
      <ActivityIndicator size="large" color={THEME.colors.secondary} />
    </Container>
  </BaseLayout>
);
