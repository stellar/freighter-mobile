import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import DappAuthEntryDetailsBottomSheet, {
  DappAuthEntryDetailsHeader,
} from "components/screens/WalletKit/DappAuthEntryDetailsBottomSheet";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback } from "react";
import { TouchableOpacity } from "react-native";

interface DappAuthEntryDetailsButtonProps {
  /** Opens the details sheet, through the ref its owner gave the sheet. */
  onPress: () => void;
}

/**
 * The "Auth entry details" button. It doesn't own the sheet it opens: see
 * {@link DappAuthEntryDetailsSheet} for why the two are apart.
 */
export const DappAuthEntryDetailsButton: React.FC<
  DappAuthEntryDetailsButtonProps
> = ({ onPress }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  return (
    <TouchableOpacity
      className="flex-row items-center gap-[8px] rounded-[16px] bg-background-tertiary px-[16px] py-[12px]"
      onPress={onPress}
      testID="dapp-auth-entry-details-button"
    >
      <Icon.List size={16} themeColor="lilac" />
      <Text color={themeColors.lilac[11]}>
        {t("dappRequestBottomSheetContent.authEntryDetails")}
      </Text>
    </TouchableOpacity>
  );
};

interface DappAuthEntryDetailsSheetProps {
  /** The ref the sheet opens and closes through. */
  modalRef: React.RefObject<BottomSheetModal | null>;
  entryXdr: string;
  /**
   * Called when the entry's details throw while rendering, after the error is
   * reported. Passed down, through the details sheet, to the error boundaries
   * around the invocations' bodies.
   */
  onRenderError?: () => void;
}

/**
 * The details sheet for `entryXdr`, opened through `modalRef`. It renders each
 * invocation's body behind an error boundary, which reports a render error
 * through `onRenderError`.
 *
 * It is apart from {@link DappAuthEntryDetailsButton} so that the request sheet
 * can keep it mounted when its own content changes. When a render error here
 * fails the request closed, the request sheet swaps its content for the
 * unreadable notice and Cancel. This sheet stays open on top, showing its own
 * notice, until the user closes it.
 */
export const DappAuthEntryDetailsSheet: React.FC<
  DappAuthEntryDetailsSheetProps
> = ({ modalRef, entryXdr, onRenderError }) => {
  const renderDetailsHeader = useCallback(
    () => (
      <DappAuthEntryDetailsHeader
        onDismiss={() => modalRef.current?.dismiss()}
      />
    ),
    [modalRef],
  );

  return (
    <BottomSheet
      modalRef={modalRef}
      scrollable
      enablePanDownToClose={false}
      analyticsEvent={AnalyticsEvent.VIEW_SIGN_DAPP_AUTH_ENTRY_DETAILS}
      scrollViewHeaderComponent={renderDetailsHeader}
      customContent={
        <DappAuthEntryDetailsBottomSheet
          entryXdr={entryXdr}
          onRenderError={onRenderError}
        />
      }
    />
  );
};
