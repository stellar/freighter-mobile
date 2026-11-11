import { BottomSheetHeader } from "components/BottomSheetHeader";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

export enum CannotRemoveType {
  hasBalance = "has-balance",
  native = "native",
  /**
   * A contract token the backend reports on its own rather than one the user
   * added by hand. Dropping the local entry would not stop it coming back, so
   * it can only be hidden.
   */
  notLocallyAdded = "not-locally-added",
}

type CannotRemoveTokenBottomSheetProps = {
  type: CannotRemoveType;
  onDismiss: () => unknown;
};

const CannotRemoveTokenBottomSheet: React.FC<
  CannotRemoveTokenBottomSheetProps
> = ({ type, onDismiss }) => {
  const { t } = useAppTranslation();

  // Spelled out rather than built from a template so the i18n key types keep
  // catching typos and missing translations.
  const copy = {
    [CannotRemoveType.hasBalance]: {
      title: t("manageTokensScreen.cantRemoveBalance.title"),
      description: t("manageTokensScreen.cantRemoveBalance.description"),
    },
    [CannotRemoveType.native]: {
      title: t("manageTokensScreen.cantRemoveXlm.title"),
      description: t("manageTokensScreen.cantRemoveXlm.description"),
    },
    [CannotRemoveType.notLocallyAdded]: {
      title: t("manageTokensScreen.cantRemoveNotLocallyAdded.title"),
      description: t(
        "manageTokensScreen.cantRemoveNotLocallyAdded.description",
      ),
    },
  }[type];

  const { title, description } = copy;

  return (
    <View className="gap-[24px]">
      <BottomSheetHeader
        title={title}
        onClose={onDismiss}
        titleTestID="bottom-sheet-content-title"
      />
      <Text md regular secondary>
        {description}
      </Text>
    </View>
  );
};

export default CannotRemoveTokenBottomSheet;
