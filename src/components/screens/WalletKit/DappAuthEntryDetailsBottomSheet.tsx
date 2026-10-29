import { PinnedBottomSheetHeader } from "components/BottomSheetHeader";
import { DappAuthEntryDisplay } from "components/screens/WalletKit/DappAuthEntryDisplay";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface DappAuthEntryDetailsBottomSheetProps {
  entryXdr: string;
}

/**
 * Title row for the auth entry details sheet. The host passes it as the
 * wrapper's `scrollViewHeaderComponent`, so it stays pinned while the entry
 * scrolls; the opaque background covers the content scrolling underneath.
 */
export const DappAuthEntryDetailsHeader: React.FC<{
  onDismiss: () => void;
}> = ({ onDismiss }) => {
  const { t } = useAppTranslation();

  return (
    <PinnedBottomSheetHeader
      title={t("dappRequestBottomSheetContent.authEntryDetails")}
      layout="centered"
      onClose={onDismiss}
    />
  );
};

const DappAuthEntryDetailsBottomSheet: React.FC<
  DappAuthEntryDetailsBottomSheetProps
> = ({ entryXdr }) => (
  // The host renders this in the wrapper's scrollable mode, below the pinned
  // header: the sheet sizes to this content and scrolls once it reaches its
  // maximum height.
  <View className="w-full">
    <DappAuthEntryDisplay entryXdr={entryXdr} expandAll />
  </View>
);

export default DappAuthEntryDetailsBottomSheet;
