import Spinner from "components/Spinner";
import { BaseLayout } from "components/layout/BaseLayout";
import React from "react";
import styled from "styled-components/native";

const Container = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
`;

export const LoadingScreen: React.FC = () => (
  <BaseLayout useSafeArea testID="loading-screen">
    <Container>
      <Spinner />
    </Container>
  </BaseLayout>
);
