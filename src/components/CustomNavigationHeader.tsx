import { BottomTabHeaderProps } from "@react-navigation/bottom-tabs";
import { NativeStackHeaderProps } from "@react-navigation/native-stack";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import { isAndroid } from "helpers/device";
import { calculateEdgeSpacing, px } from "helpers/dimensions";
import React from "react";
import { TouchableOpacity } from "react-native";
import { EdgeInsets, useSafeAreaInsets } from "react-native-safe-area-context";
import styled from "styled-components/native";

interface StyledProps {
  $insets: EdgeInsets;
}

const StyledContainer = styled.View<StyledProps>`
  padding-top: ${({ $insets }: StyledProps) =>
    calculateEdgeSpacing($insets.top)};
  padding-left: ${px(24)};
  padding-right: ${px(24)};
  padding-bottom: ${px(16)};
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  background-color: ${THEME.colors.background.default};
`;

const HeaderRight = styled.View`
  width: ${px(24)};
  height: ${px(24)};
`;

const CustomNavigationHeader = (
  props: NativeStackHeaderProps | BottomTabHeaderProps,
) => {
  const { navigation, options } = props;
  const insets = useSafeAreaInsets();

  return (
    <StyledContainer $insets={insets}>
      {options.headerLeft ? (
        options.headerLeft({
          canGoBack: navigation.canGoBack(),
          tintColor: THEME.colors.base.secondary,
          pressColor: THEME.colors.base.secondary,
          pressOpacity: 0.5,
        })
      ) : (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className={isAndroid ? "p-2" : undefined}
        >
          <Icon.ArrowLeft color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      )}
      {typeof options.headerTitle === "string" && (
        <Text md primary semiBold>
          {options.headerTitle}
        </Text>
      )}
      {options.headerRight ? (
        options.headerRight({
          canGoBack: navigation.canGoBack(),
          tintColor: THEME.colors.base.secondary,
          pressColor: THEME.colors.base.secondary,
          pressOpacity: 0.5,
        })
      ) : (
        <HeaderRight />
      )}
    </StyledContainer>
  );
};

export default CustomNavigationHeader;
