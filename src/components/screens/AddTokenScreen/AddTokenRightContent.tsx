import { IconPosition, Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import React, { memo } from "react";

type AddTokenRightContentProps = {
  handleAddToken: () => void;
};

const AddTokenRightContent: React.FC<AddTokenRightContentProps> = ({
  handleAddToken,
}) => {
  const { t } = useAppTranslation();

  return (
    <Button
      tertiary
      squared
      testID="add-token-button"
      icon={<Icon.PlusCircle size={16} />}
      iconPosition={IconPosition.RIGHT}
      onPress={handleAddToken}
    >
      {t("common.add")}
    </Button>
  );
};

export default memo(AddTokenRightContent);
