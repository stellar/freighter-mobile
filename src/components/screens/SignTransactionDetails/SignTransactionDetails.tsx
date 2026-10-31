import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import SignTransactionDetailsBottomSheet, {
  SignTransactionDetailsHeader,
} from "components/screens/SignTransactionDetails/components/SignTransactionDetailsBottomSheet";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { AnalyticsEvent } from "config/analyticsConfig";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useRef } from "react";
import { TouchableOpacity } from "react-native";

interface SignTransactionDetailsButtonProps {
  /** Opens the details sheet, through the ref its owner gave the sheet. */
  onPress: () => void;
}

/**
 * The "Transaction details" button. It doesn't own the sheet it opens: see
 * {@link SignTransactionDetailsSheet} for why the two are apart.
 */
export const SignTransactionDetailsButton: React.FC<
  SignTransactionDetailsButtonProps
> = ({ onPress }) => {
  const { themeColors } = useColors();
  const { t } = useAppTranslation();

  return (
    <TouchableOpacity
      className="flex-row items-center gap-[8px] rounded-[16px] bg-background-tertiary px-[16px] py-[12px]"
      onPress={onPress}
    >
      <Icon.List size={16} themeColor="lilac" />
      <Text color={themeColors.lilac[11]}>
        {t("dappRequestBottomSheetContent.transactionDetails")}
      </Text>
    </TouchableOpacity>
  );
};

interface SignTransactionDetailsSheetProps {
  /** The ref the sheet opens and closes through. */
  modalRef: React.RefObject<BottomSheetModal | null>;
  analyticsEvent?: AnalyticsEvent;
  data: SignTransactionDetailsInterface;
  /**
   * Called once when the details throw while rendering. Passed through to
   * {@link SignTransactionDetailsBottomSheet}'s error boundary.
   */
  onRenderError?: () => void;
}

/**
 * The details sheet for `data`, opened through `modalRef`. Its sections render
 * behind an error boundary, which reports a render error through
 * `onRenderError`.
 *
 * It is apart from {@link SignTransactionDetailsButton} so that a request sheet
 * can keep it mounted when its own content changes. When a render error here
 * fails the request closed, the request sheet swaps its content for the
 * unreadable notice and Cancel. This sheet stays open on top, showing its own
 * notice, until the user closes it.
 */
export const SignTransactionDetailsSheet: React.FC<
  SignTransactionDetailsSheetProps
> = ({ modalRef, analyticsEvent, data, onRenderError }) => {
  const handleDismiss = useCallback(() => {
    modalRef.current?.dismiss();
  }, [modalRef]);

  const renderDetailsHeader = useCallback(
    () => <SignTransactionDetailsHeader onDismiss={handleDismiss} />,
    [handleDismiss],
  );

  return (
    <BottomSheet
      modalRef={modalRef}
      scrollable
      enablePanDownToClose={false}
      analyticsEvent={analyticsEvent}
      scrollViewHeaderComponent={renderDetailsHeader}
      customContent={
        <SignTransactionDetailsBottomSheet
          data={data}
          onRenderError={onRenderError}
        />
      }
    />
  );
};

interface SignTransactionDetailsProps {
  analyticsEvent?: AnalyticsEvent;
  data: SignTransactionDetailsInterface;
  /**
   * Called once when the details throw while rendering. Passed through to
   * {@link SignTransactionDetailsBottomSheet}'s error boundary.
   */
  onRenderError?: () => void;
}

/**
 * The "Transaction details" button and the sheet it opens, for a screen whose
 * content doesn't change under the sheet, such as send's review sheet. A dApp
 * request sheet uses the two apart instead (see
 * {@link SignTransactionDetailsSheet}).
 */
const SignTransactionDetails: React.FC<SignTransactionDetailsProps> = ({
  analyticsEvent,
  data,
  onRenderError,
}) => {
  const modalRef = useRef<BottomSheetModal>(null);

  return (
    <>
      <SignTransactionDetailsButton
        onPress={() => modalRef.current?.present()}
      />
      <SignTransactionDetailsSheet
        modalRef={modalRef}
        analyticsEvent={analyticsEvent}
        data={data}
        onRenderError={onRenderError}
      />
    </>
  );
};

export default SignTransactionDetails;
