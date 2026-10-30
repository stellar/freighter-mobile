import { PinnedBottomSheetHeader } from "components/BottomSheetHeader";
import { ErrorBoundary } from "components/ErrorBoundary";
import SignTransactionAuthorizations from "components/screens/SignTransactionDetails/components/SignTransactionAuthorizations";
import SignTransactionOperationDetails from "components/screens/SignTransactionDetails/components/SignTransactionOperationDetails";
import SignTransactionSummary from "components/screens/SignTransactionDetails/components/SignTransactionSummary";
import { UnreadableTransactionNotice } from "components/screens/SignTransactionDetails/components/UnreadableTransactionNotice";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface SignTransactionDetailsBottomSheetProps {
  data: SignTransactionDetailsInterface;
  /**
   * Called once when the details throw while rendering, after the error is
   * reported. A dApp request uses it to fail closed. Send and swap pass
   * nothing, so for them the notice is all that changes.
   */
  onRenderError?: () => void;
}

/**
 * Title row for the transaction details sheet. Hosts pass it as the wrapper's
 * `scrollViewHeaderComponent`, so it stays pinned while the details scroll;
 * the opaque background covers the content scrolling underneath.
 */
export const SignTransactionDetailsHeader: React.FC<{
  onDismiss: () => void;
}> = ({ onDismiss }) => {
  const { t } = useAppTranslation();

  return (
    <PinnedBottomSheetHeader
      title={t("signTransactionDetails.title")}
      layout="centered"
      onClose={onDismiss}
    />
  );
};

/**
 * The body of the transaction details sheet: the summary, the authorizations
 * and the operations.
 *
 * The three sections render behind one error boundary. If any of them throws
 * while rendering, the boundary reports the error, shows the unreadable notice
 * in place of all three and calls `onRenderError`. It renders them again once
 * the transaction (`data.summary.xdr`) changes.
 */
const SignTransactionDetailsBottomSheet = ({
  data,
  onRenderError,
}: SignTransactionDetailsBottomSheetProps) => (
  // The host renders this in the wrapper's scrollable mode, below the pinned
  // header: the sheet sizes to this content and scrolls once it reaches its
  // maximum height.
  <View className="w-full gap-[16px]">
    <ErrorBoundary
      name="SignTransactionDetails"
      fallback={<UnreadableTransactionNotice />}
      onError={onRenderError}
      resetKey={data.summary.xdr}
    >
      <SignTransactionSummary summary={data.summary} />
      {data.authEntries.length > 0 && (
        <SignTransactionAuthorizations authEntries={data.authEntries} />
      )}
      {data.operations.length > 0 && (
        <SignTransactionOperationDetails operations={data.operations} />
      )}
    </ErrorBoundary>
  </View>
);

export default SignTransactionDetailsBottomSheet;
