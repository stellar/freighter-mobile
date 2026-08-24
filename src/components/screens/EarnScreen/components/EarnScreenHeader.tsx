import Icon from "components/sds/Icon";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { TouchableOpacity, View } from "react-native";

/**
 * Both redesigned Earn frames (Figma `13701:332561` and `13701:332629`) put a
 * bare 24px X at the top left with nothing else in the header -- no title, no
 * right-hand control. The second icon present in each node carries
 * `opacity="0"`; it is an alignment spacer in the mock, not a control, so it
 * is deliberately not rendered here.
 *
 * Both frames place the icon's box at y=70..94 over a 59pt safe area, hence
 * the 11pt offset below the inset. On devices with a shallower inset the icon
 * simply follows it down, keeping the same visual relationship to the notch.
 *
 * The band wraps the icon exactly (24pt tall) so callers can express their
 * content's offset as the design's own icon-bottom-to-content distance
 * without having to net out padding baked in here.
 */
export interface EarnScreenHeaderProps {
  onClose: () => void;
  testID?: string;
}

export const EarnScreenHeader: React.FC<EarnScreenHeaderProps> = ({
  onClose,
  testID = "earn-header-close",
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="mt-[11px] h-6 flex-row items-center">
      <TouchableOpacity
        onPress={onClose}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel={t("common.close")}
        testID={testID}
      >
        <Icon.X color={themeColors.text.primary} size={24} />
      </TouchableOpacity>
    </View>
  );
};

export default EarnScreenHeader;
