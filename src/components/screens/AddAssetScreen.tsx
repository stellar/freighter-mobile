/* eslint-disable react/no-unstable-nested-components */
import Clipboard from "@react-native-clipboard/clipboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import ContextMenuButton from "components/ContextMenuButton";
import { SimpleBalancesList } from "components/SimpleBalancesList";
import { BaseLayout } from "components/layout/BaseLayout";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { logger } from "config/logger";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { PALETTE, THEME } from "config/theme";
import { PricedBalance } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { px, pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useState } from "react";
import { Platform, TouchableOpacity } from "react-native";
import styled from "styled-components/native";

type AddAssetScreenProps = NativeStackScreenProps<
  ManageAssetsStackParamList,
  typeof MANAGE_ASSETS_ROUTES.ADD_ASSET_SCREEN
>;

const Spacer = styled.View`
  height: ${px(16)};
`;

const icons = Platform.select({
  ios: {
    copyAddress: "doc.on.doc",
    hideAsset: "eye.slash",
    removeAsset: "minus.circle",
  },
  android: {
    copyAddress: "baseline_format_paint",
    hideAsset: "baseline_delete",
    removeAsset: "outline_circle",
  },
});

const AddAssetScreen: React.FC<AddAssetScreenProps> = ({ navigation }) => {
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { t } = useAppTranslation();

  const [search, setSearch] = useState("");

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

  const actionsOnPress = {
    [t("manageAssetsScreen.actions.copyAddress")]: (balance: PricedBalance) =>
      Clipboard.setString(balance.tokenCode ?? ""),
    [t("manageAssetsScreen.actions.hideAsset")]: () =>
      logger.debug("ManageAssetsScreen", "hideAsset Not implemented"),
    [t("manageAssetsScreen.actions.removeAsset")]: () =>
      logger.debug("ManageAssetsScreen", "removeAsset Not implemented"),
  };

  const actions = [
    {
      inlineChildren: true,
      disabled: true,
      actions: [
        {
          title: t("manageAssetsScreen.actions.copyAddress"),
          systemIcon: icons!.copyAddress,
        },
        {
          title: t("manageAssetsScreen.actions.hideAsset"),
          systemIcon: icons!.hideAsset,
        },
      ],
      title: "",
    },
    {
      title: t("manageAssetsScreen.actions.removeAsset"),
      systemIcon: icons!.removeAsset,
      destructive: true,
    },
  ];

  const defaultRightContent = (balance: PricedBalance) => (
    <ContextMenuButton
      contextMenuProps={{
        onPress: (e) => {
          actionsOnPress[e.nativeEvent.name](balance);
        },
        actions,
      }}
    >
      <Icon.DotsHorizontal
        size={pxValue(24)}
        color={THEME.colors.foreground.primary}
      />
    </ContextMenuButton>
  );

  // const addAssetRightContent = (balance: PricedBalance) => (
  //   <Button
  //     secondary
  //     squared
  //     lg
  //     testID="add-asset-button"
  //     icon={
  //       <Icon.PlusCircle size={pxValue(16)} color={PALETTE.dark.gray["09"]} />
  //     }
  //     iconPosition={IconPosition.RIGHT}
  //     onPress={() => {
  //       logger.debug("AddAssetScreen", "addAssetButton Not implemented", {
  //         balance,
  //       });
  //     }}
  //   >
  //     {t("addAssetScreen.add")}
  //   </Button>
  // );

  const handlePasteFromClipboard = () => {
    Clipboard.getString().then((value) => {
      setSearch(value);
    });
  };

  return (
    <BaseLayout
      insets={{ bottom: true, left: true, right: true, top: false }}
      useKeyboardAvoidingView
    >
      <Input
        placeholder={t("addAssetScreen.searchPlaceholder")}
        value={search}
        onChangeText={setSearch}
        fieldSize="md"
        leftElement={
          <Icon.SearchMd
            size={pxValue(16)}
            color={THEME.colors.foreground.primary}
          />
        }
      />
      <Spacer />
      <SimpleBalancesList
        publicKey={account?.publicKey ?? ""}
        network={network}
        renderRightContent={defaultRightContent}
      />
      <Spacer />
      <Button
        secondary
        lg
        testID="paste-from-clipboard-button"
        onPress={handlePasteFromClipboard}
        icon={<Icon.Clipboard size={16} color={PALETTE.dark.gray["09"]} />}
      >
        {t("addAssetScreen.pasteFromClipboard")}
      </Button>
    </BaseLayout>
  );
};

export default AddAssetScreen;
