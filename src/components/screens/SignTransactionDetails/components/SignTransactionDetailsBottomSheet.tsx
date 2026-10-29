import { PinnedBottomSheetHeader } from "components/BottomSheetHeader";
import SignTransactionAuthorizations from "components/screens/SignTransactionDetails/components/SignTransactionAuthorizations";
import SignTransactionOperationDetails from "components/screens/SignTransactionDetails/components/SignTransactionOperationDetails";
import SignTransactionSummary from "components/screens/SignTransactionDetails/components/SignTransactionSummary";
import { SignTransactionDetailsInterface } from "components/screens/SignTransactionDetails/types";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface SignTransactionDetailsBottomSheetProps {
  data: SignTransactionDetailsInterface;
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

const SignTransactionDetailsBottomSheet = ({
  data,
}: SignTransactionDetailsBottomSheetProps) => (
  // The host renders this in the wrapper's scrollable mode, below the pinned
  // header: the sheet sizes to this content and scrolls once it reaches its
  // maximum height.
  <View className="w-full gap-[16px]">
    <SignTransactionSummary summary={data.summary} />
    {data.authEntries.length > 0 && (
      <SignTransactionAuthorizations authEntries={data.authEntries} />
    )}
    {data.operations.length > 0 && (
      <SignTransactionOperationDetails operations={data.operations} />
    )}
  </View>
);

export default SignTransactionDetailsBottomSheet;
