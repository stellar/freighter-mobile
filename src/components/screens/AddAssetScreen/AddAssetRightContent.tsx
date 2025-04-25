import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";

type AddAssetRightContentProps = {
  handleAddAsset: () => void;
};

const AddAssetRightContent: React.FC<AddAssetRightContentProps> = ({
  handleAddAsset,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <Button
      secondary
      squared
      lg
      testID="add-asset-button"
      icon={
        <Icon.PlusCircle size={16} color={themeColors.foreground.primary} />
      }
      iconPosition={IconPosition.RIGHT}
      onPress={handleAddAsset}
    >
      {t("addAssetScreen.add")}
    </Button>
  );
};

export default AddAssetRightContent;
