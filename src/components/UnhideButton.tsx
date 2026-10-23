import { Button, IconPosition } from "components/sds/Button";
import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { memo } from "react";

interface UnhideButtonProps {
  onPress: () => void;
  isLoading?: boolean;
  testID?: string;
}

/**
 * The "Unhide" action shown next to a hidden token, collectible or search
 * result. Shares the squared tertiary look of the Add token button so the
 * two read as the same kind of control.
 */
const UnhideButton: React.FC<UnhideButtonProps> = ({
  onPress,
  isLoading = false,
  testID = "unhide-button",
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <Button
      tertiary
      squared
      testID={testID}
      icon={<Icon.Eye size={16} color={themeColors.foreground.primary} />}
      iconPosition={IconPosition.RIGHT}
      onPress={onPress}
      isLoading={isLoading}
      disabled={isLoading}
    >
      {t("common.unhide")}
    </Button>
  );
};

export default memo(UnhideButton);
