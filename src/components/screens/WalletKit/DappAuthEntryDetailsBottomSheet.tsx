import { PinnedBottomSheetHeader } from "components/BottomSheetHeader";
import { DappAuthEntryDisplay } from "components/screens/WalletKit/DappAuthEntryDisplay";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface DappAuthEntryDetailsBottomSheetProps {
  entryXdr: string;
  /**
   * Called when an invocation's body throws while rendering, after the error is
   * reported. Passed through to {@link DappAuthEntryDisplay}, whose error
   * boundaries call it.
   */
  onRenderError?: () => void;
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
      closeTestID="dapp-auth-entry-details-close-button"
    />
  );
};

/**
 * The body of the auth entry details sheet: the entry's display, with every
 * invocation expanded. Each invocation's body renders behind an error boundary,
 * which reports a render error through `onRenderError`.
 */
const DappAuthEntryDetailsBottomSheet: React.FC<
  DappAuthEntryDetailsBottomSheetProps
> = ({ entryXdr, onRenderError }) => (
  // The host renders this in the wrapper's scrollable mode, below the pinned
  // header: the sheet sizes to this content and scrolls once it reaches its
  // maximum height.
  <View className="w-full">
    <DappAuthEntryDisplay
      entryXdr={entryXdr}
      expandAll
      onRenderError={onRenderError}
    />
  </View>
);

export default DappAuthEntryDetailsBottomSheet;
