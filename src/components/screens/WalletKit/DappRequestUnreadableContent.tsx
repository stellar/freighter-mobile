import { UnreadableTransactionNotice } from "components/screens/SignTransactionDetails/components/UnreadableTransactionNotice";
import { Button } from "components/sds/Button";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface DappRequestUnreadableContentProps {
  /** The request sheet's header row: the dApp and what it is asking for. */
  header: React.ReactNode;
  /** Rejects the request. */
  onCancelRequest: () => void;
  /**
   * An approval is already in flight, which is possible when the details only
   * fail to render after the user confirmed. Cancel is disabled while it is,
   * like the request buttons' Cancel, so that a rejection doesn't go out for a
   * request that may still be signed.
   */
  isSigning?: boolean;
}

/**
 * The request sheet's content for a dApp request whose details can't be
 * displayed. It fails closed: the header, the unreadable notice and a single
 * Cancel, which rejects the request, except while an approval is already in
 * flight (`isSigning`), when Cancel is disabled.
 *
 * There is no Confirm, because confirming would be signing blind, and there
 * are no banners: the Blockaid one opens a sheet that offers to confirm
 * anyway.
 */
export const DappRequestUnreadableContent: React.FC<
  DappRequestUnreadableContentProps
> = ({ header, onCancelRequest, isSigning }) => {
  const { t } = useAppTranslation();

  return (
    <View
      className="flex-1 justify-center mt-2 gap-[16px]"
      testID="dapp-request-bottom-sheet"
    >
      {header}

      <UnreadableTransactionNotice />

      <View className="w-full">
        <Button
          tertiary
          xl
          isFullWidth
          onPress={onCancelRequest}
          disabled={isSigning}
          testID="dapp-request-cancel-button"
        >
          {t("common.cancel")}
        </Button>
      </View>
    </View>
  );
};
