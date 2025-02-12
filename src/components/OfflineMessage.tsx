import React from 'react';
import styled from 'styled-components/native';
import {COLORS} from '../config/theme';

const Container = styled.View`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background-color: ${COLORS.error};
  padding: 8px;
  align-items: center;
  z-index: 1;
`;

const Message = styled.Text`
  color: ${COLORS.text.white};
  font-size: 14px;
`;

export const OfflineMessage = () => (
  <Container>
    <Message>No internet connection</Message>
  </Container>
); 