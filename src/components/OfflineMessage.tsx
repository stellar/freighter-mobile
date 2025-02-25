import { THEME } from "config/sds/theme";
import { px, fs } from "helpers/dimensions";
import React from "react";
import styled from "styled-components/native";

const SafeContainer = styled.SafeAreaView`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background-color: ${THEME.colors.status.error};
  z-index: 1;
`;

const Content = styled.View`
  padding: ${px(8)};
  align-items: center;
`;

const Message = styled.Text`
  color: ${THEME.colors.text.primary};
  font-size: ${fs(14)};
`;

export const OfflineMessage = () => (
  <SafeContainer>
    <Content>
      <Message>No internet connection</Message>
    </Content>
  </SafeContainer>
);
