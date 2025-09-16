import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";

type AddTokenRightContentProps = {
  handleAddToken: () => void;
};

const AddTokenRightContent: React.FC<AddTokenRightContentProps> = ({
  handleAddToken,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <Button
      secondary
      squared
      testID="add-token-button"
      icon={
        <Icon.PlusCircle size={16} color={themeColors.foreground.primary} />
      }
      iconPosition={IconPosition.RIGHT}
      onPress={handleAddToken}
    >
      {t("common.add")}
    </Button>
  );
};

export default AddTokenRightContent;
