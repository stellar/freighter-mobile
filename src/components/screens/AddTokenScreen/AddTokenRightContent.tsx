import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";

type AddTokenRightContentProps = {
  handleAddToken: () => void;
  isScanningToken: boolean;
};

const AddTokenRightContent: React.FC<AddTokenRightContentProps> = ({
  handleAddToken,
  isScanningToken,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <Button
      secondary
      squared
      lg
      testID="add-token-button"
      icon={
        <Icon.PlusCircle size={16} color={themeColors.foreground.primary} />
      }
      iconPosition={IconPosition.RIGHT}
      onPress={handleAddToken}
      disabled={isScanningToken}
      isLoading={isScanningToken}
    >
      {t("common.add")}
    </Button>
  );
};

export default AddTokenRightContent;
