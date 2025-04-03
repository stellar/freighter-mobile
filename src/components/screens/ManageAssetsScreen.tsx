/* eslint-disable react/no-unstable-nested-components */
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import {
  MANAGE_ASSETS_ROUTES,
  ManageAssetsStackParamList,
} from "config/routes";
import { THEME } from "config/theme";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React, { useEffect, useState } from "react";
import { TouchableOpacity } from "react-native";

type ManageAssetsScreenProps = NativeStackScreenProps<
  ManageAssetsStackParamList,
  typeof MANAGE_ASSETS_ROUTES.MANAGE_ASSETS_SCREEN
>;

const ManageAssetsScreen: React.FC<ManageAssetsScreenProps> = ({
  navigation,
}) => {
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

  return (
    <BaseLayout
      useKeyboardAvoidingView
      insets={{ bottom: false, left: true, right: true, top: false }}
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
    </BaseLayout>
  );
};

export default ManageAssetsScreen;
