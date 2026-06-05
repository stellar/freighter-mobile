import { BottomSheetModal } from "@gorhom/bottom-sheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";

export interface TrustlineInfoBottomSheetProps {
  bottomSheetModalRef?: React.RefObject<BottomSheetModal | null>;
  /**
   * Destination token code, interpolated into the title and body
   * ("This will add a trustline to AQUA").
   */
  tokenCode?: string;
}

export const TrustlineInfoBottomSheet: React.FC<
  TrustlineInfoBottomSheetProps
> = ({ bottomSheetModalRef, tokenCode }) => {
  const { t } = useAppTranslation();

  const handleConfirm = () => {
    bottomSheetModalRef?.current?.dismiss();
  };

  const interpolation = { tokenCode: tokenCode ?? "" };

  return (
    <InformationBottomSheet
      onClose={handleConfirm}
      onConfirm={handleConfirm}
      confirmLabel={t("swapScreen.trustlineInfo.confirm")}
      closeTestID="trustline-info-close"
      headerElement={
        <Icon.PlusCircle themeColor="lilac" withBackground square size={28} />
      }
      title={t("swapScreen.trustlineInfo.title", interpolation)}
      texts={[
        {
          key: "body",
          // Inline emphasis in the middle of the paragraph — passed as
          // ReactNode so the medium-weight span survives. Nested <Text>
          // inherits the parent's `md regular secondary` styling and
          // overrides only the weight on the emphasized span.
          value: (
            <>
              {t("swapScreen.trustlineInfo.bodyPrefix", interpolation)}
              <Text md medium>
                {t("swapScreen.trustlineInfo.bodyEmphasis")}
              </Text>
              {t("swapScreen.trustlineInfo.bodySuffix", interpolation)}
            </>
          ),
        },
      ]}
    />
  );
};

export default TrustlineInfoBottomSheet;
