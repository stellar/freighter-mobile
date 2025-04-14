/* eslint-disable react/no-unstable-nested-components */
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import BottomSheet from "components/BottomSheet";
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
import { px } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import { useAssetActions } from "hooks/useAssetActions";
import { useClipboard } from "hooks/useClipboard";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import React, { useEffect, useRef, useState } from "react";
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
  const { copyAssetAddress } = useAssetActions();
  const { getClipboardText } = useClipboard();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const { t } = useAppTranslation();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const [search, setSearch] = useState("");

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon.X size={24} color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => bottomSheetModalRef.current?.present()}
        >
          <Icon.HelpCircle size={24} color={THEME.colors.base.secondary} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  const handleCopyTokenAddress = (balance: PricedBalance) => {
    copyAssetAddress(balance, "addAssetScreen.tokenAddressCopied");
  };

  const defaultRightContent = (balance: PricedBalance) => {
    const menuActions = [
      {
        title: t("manageAssetsScreen.actions.copyAddress"),
        systemIcon: icons!.copyAddress,
        onPress: () => handleCopyTokenAddress(balance),
        disabled: true,
      },
      {
        title: t("manageAssetsScreen.actions.hideAsset"),
        systemIcon: icons!.hideAsset,
        onPress: () =>
          logger.debug("ManageAssetsScreen", "hideAsset Not implemented"),
        disabled: true,
      },
      {
        title: t("manageAssetsScreen.actions.removeAsset"),
        systemIcon: icons!.removeAsset,
        onPress: () =>
          logger.debug("ManageAssetsScreen", "removeAsset Not implemented"),
        destructive: true,
      },
    ];

    return (
      <ContextMenuButton
        contextMenuProps={{
          actions: menuActions,
        }}
      >
        <Icon.DotsHorizontal
          size={24}
          color={THEME.colors.foreground.primary}
        />
      </ContextMenuButton>
    );
  };

  // TODO: Use that component when integrating the add asset feature
  // const addAssetRightContent = (balance: PricedBalance) => (
  //   <Button
  //     secondary
  //     squared
  //     lg
  //     testID="add-asset-button"
  //     icon={
  //       <Icon.PlusCircle size={16} color={PALETTE.dark.gray["09"]} />
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
    getClipboardText().then((value) => {
      setSearch(value);
    });
  };

  return (
    <BaseLayout insets={{ top: false }} useKeyboardAvoidingView>
      <BottomSheet
        title={t("manageAssetsScreen.moreInfo.title")}
        description={`${t("manageAssetsScreen.moreInfo.block1")}\n\n${t("manageAssetsScreen.moreInfo.block2")}`}
        modalRef={bottomSheetModalRef}
        handleCloseModal={() => bottomSheetModalRef.current?.dismiss()}
      />
      <Input
        placeholder={t("addAssetScreen.searchPlaceholder")}
        value={search}
        onChangeText={setSearch}
        fieldSize="md"
        leftElement={
          <Icon.SearchMd size={16} color={THEME.colors.foreground.primary} />
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
