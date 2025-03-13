import { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import Icon from "components/sds/Icon";
import { THEME } from "config/theme";
import { isIOS } from "helpers/device";
import { px } from "helpers/dimensions";
import React from "react";
import { TouchableOpacity } from "react-native";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";

interface StyledProps {
  $insets: EdgeInsets;
}

const StyledContainer = styled.View<StyledProps>`
  padding-top: ${({ $insets }: StyledProps) =>
    isIOS ? px($insets.top) : px(32)};
  padding-left: ${px(24)};
  padding-right: ${px(24)};
  padding-bottom: ${px(16)};
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  background-color: ${THEME.colors.background.default};
`;

const CustomNavigationHeader = (
  props: NativeStackHeaderProps | BottomTabHeaderProps,
) => {
  const { navigation } = props;
  const insets = useSafeAreaInsets();

  return (
    <StyledContainer $insets={insets}>
      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Icon.ArrowLeft color={THEME.colors.base.secondary} />
      </TouchableOpacity>
    </StyledContainer>
  );
};

export default CustomNavigationHeader;
