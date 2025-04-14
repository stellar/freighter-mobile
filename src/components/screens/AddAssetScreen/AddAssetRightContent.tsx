import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { PALETTE } from "config/theme";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

type AddAssetRightContentProps = {
  hasTrustline: boolean;
  onPress: () => void;
};

const AddAssetRightContent: React.FC<AddAssetRightContentProps> = ({
  hasTrustline,
  onPress,
}) => {
  const { t } = useAppTranslation();
  return (
    <Button
      secondary
      squared
      lg
      disabled={hasTrustline}
      testID="add-asset-button"
      icon={
        <Icon.PlusCircle size={pxValue(16)} color={PALETTE.dark.gray["09"]} />
      }
      iconPosition={IconPosition.RIGHT}
      onPress={onPress}
    >
      {t("addAssetScreen.add")}
    </Button>
  );
};

export default AddAssetRightContent;
