/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BalancesList } from "components/BalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { THEME } from "config/theme";
import { useAuthenticationStore } from "ducks/auth";
import { px, pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useState } from "react";
import { TouchableOpacity } from "react-native";
import styled from "styled-components/native";

type ManageAssetsScreenProps = NativeStackScreenProps<
  ManageAssetsStackParamList,
  typeof MANAGE_ASSETS_ROUTES.MANAGE_ASSETS_SCREEN
>;

const Spacer = styled.View`
  height: ${px(16)};
`;

// const icons = Platform.select({
//   ios: {
//     copyAddress: "doc.on.doc",
//     hideAsset: "eye.slash",
//     removeAsset: "minus.circle",
//   },
//   android: {
//     copyAddress: "baseline_format_paint",
//     hideAsset: "baseline_delete",
//     removeAsset: "outline_circle",
//   },
// });

const ManageAssetsScreen: React.FC<ManageAssetsScreenProps> = ({
  navigation,
}) => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const [search, setSearch] = useState("");
  const { t } = useAppTranslation();

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={pxValue(24)} color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={() => {}}>
          <Icon.HelpCircle
            size={pxValue(24)}
            color={THEME.colors.base.secondary}
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  // const actionsOnPress = {
  //   [t("manageAssetsScreen.actions.copyAddress")]: (balance: PricedBalance) =>
  //     Clipboard.setString(balance.tokenCode ?? ""),
  //   [t("manageAssetsScreen.actions.hideAsset")]: () =>
  //     logger.debug("ManageAssetsScreen", "hideAsset Not implemented"),
  //   [t("manageAssetsScreen.actions.removeAsset")]: () =>
  //     logger.debug("ManageAssetsScreen", "removeAsset Not implemented"),
  // };

  // const actions = [
  //   {
  //     inlineChildren: true,
  //     disabled: true,
  //     actions: [
  //       {
  //         title: t("manageAssetsScreen.actions.copyAddress"),
  //         systemIcon: icons!.copyAddress,
  //       },
  //       {
  //         title: t("manageAssetsScreen.actions.hideAsset"),
  //         systemIcon: icons!.hideAsset,
  //       },
  //     ],
  //     title: "",
  //   },
  //   {
  //     title: t("manageAssetsScreen.actions.removeAsset"),
  //     systemIcon: icons!.removeAsset,
  //     destructive: true,
  //   },
  // ];

  // const rightContent = (balance: PricedBalance) => (
  //   <ContextMenuButton
  //     contextMenuProps={{
  //       onPress: (e) => {
  //         actionsOnPress[e.nativeEvent.name](balance);
  //       },
  //       actions,
  //     }}
  //   >
  //     <Icon.DotsHorizontal
  //       size={pxValue(24)}
  //       color={THEME.colors.foreground.primary}
  //     />
  //   </ContextMenuButton>
  // );

  return (
    <BaseLayout
      insets={{ bottom: false, left: true, right: true, top: false }}
      useKeyboardAvoidingView
    >
      <Input
        placeholder={t("manageAssetsScreen.searchPlaceholder")}
        value={search}
        onChangeText={setSearch}
        fieldSize="lg"
        leftElement={
          <Icon.SearchMd
            size={pxValue(16)}
            color={THEME.colors.foreground.primary}
          />
        }
      />
      <Spacer />
      <BalancesList publicKey={account?.publicKey ?? ""} network={network} />
    </BaseLayout>
  );
};
export default ManageAssetsScreen;
