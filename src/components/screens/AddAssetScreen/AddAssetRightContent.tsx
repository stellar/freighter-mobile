import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
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
  const { themeColors } = useColors();

  return (
    <Button
      secondary
      squared
      lg
      disabled={hasTrustline}
      testID="add-asset-button"
      icon={
        <Icon.PlusCircle
          size={pxValue(16)}
          color={themeColors.foreground.primary}
        />
      }
      iconPosition={IconPosition.RIGHT}
      onPress={onPress}
    >
      {t("addAssetScreen.add")}
    </Button>
  );
};

export default AddAssetRightContent;
