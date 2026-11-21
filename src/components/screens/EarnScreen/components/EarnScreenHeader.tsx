import { CustomHeaderButton } from "components/layout/CustomHeaderButton";
import { NavigationHeaderBar } from "components/layout/CustomNavigationHeader";
import React from "react";

/**
 * The bare-X header of the Earn screens that draw their own header (the intro
 * and the token picker). It is Varial's standard nav bar with only a close
 * button, so the X lands exactly where every other screen's does.
 *
 * Transparent, so the intro's glow shows through behind it.
 */
export interface EarnScreenHeaderProps {
  onClose: () => void;
  testID?: string;
}

export const EarnScreenHeader: React.FC<EarnScreenHeaderProps> = ({
  onClose,
  testID = "earn-header-close",
}) => (
  <NavigationHeaderBar
    isTransparent
    left={
      <CustomHeaderButton variant="close" onPress={onClose} testID={testID} />
    }
  />
);

export default EarnScreenHeader;
