import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { BalanceRow } from "components/BalanceRow";
import BottomSheet from "components/BottomSheet";
import ManageTokenRightContent from "components/ManageTokenRightContent";
import CannotRemoveXlmBottomSheet from "components/screens/AddTokenScreen/CannotRemoveXlmBottomSheet";
import RemoveTokenBottomSheetContent from "components/screens/AddTokenScreen/RemoveTokenBottomSheet";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { RemoveTokenParams } from "hooks/useManageTokens";
import React, { useCallback, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { analytics } from "services/analytics";

type UseBalanceList = ReturnType<typeof useBalancesList>;
type Balance = UseBalanceList["balanceItems"][number];

interface SimpleBalancesListProps {
  publicKey: string;
  network: NETWORKS;
  rightSectionWidth?: number;
  handleRemoveToken: (input: RemoveTokenParams) => void;
  isRemovingToken: boolean;
}

/**
 * SimpleBalancesList Component
 *
 * A simplified version of the balances list that just renders the balance rows
 * without any container, title, or pull-to-refresh functionality.
 * Suitable for embedding in other scrollable containers.
 *
 * Features:
 * - Displays regular tokens and liquidity pool tokens
 * - Customizable right content through renderRightContent prop
 * - No pull-to-refresh or loading states
 *
 * @param {SimpleBalancesListProps} props - Component props
 * @returns {JSX.Element} A list of balance rows
 */
export const SimpleBalancesList: React.FC<SimpleBalancesListProps> = ({
  publicKey,
  network,
  rightSectionWidth,
  handleRemoveToken,
  isRemovingToken,
}) => {
  const removeTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { account } = useGetActiveAccount();
  const [selectedToken, setSelectedToken] = useState<Balance | null>(null);

  const { balanceItems } = useBalancesList({
    publicKey,
    network,
    shouldPoll: false,
  });

  const handleConfirmTokenRemoval = useCallback(() => {
    if (!selectedToken) {
      return;
    }

    analytics.trackRemoveTokenConfirmed(selectedToken.tokenCode);

    handleRemoveToken({
      tokenId: selectedToken.id,
      tokenType: selectedToken.tokenType,
    });

    removeTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedToken, handleRemoveToken]);

  const handleCancelTokenRemoval = useCallback(() => {
    if (selectedToken) {
      analytics.trackRemoveTokenRejected(selectedToken.tokenCode);
    }

    removeTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedToken]);

  if (!balanceItems.length) {
    return null;
  }

  const renderBottomSheet = () => {
    const selectedTokenIssuer =
      selectedToken &&
      "token" in selectedToken &&
      "issuer" in selectedToken.token
        ? selectedToken.token.issuer.key
        : "XLM";
    if (selectedToken && selectedTokenIssuer === "XLM") {
      return (
        <CannotRemoveXlmBottomSheet
          onDismiss={() => {
            removeTokenBottomSheetModalRef.current?.dismiss();
          }}
        />
      );
    }

    if (selectedToken && selectedTokenIssuer) {
      <RemoveTokenBottomSheetContent
        token={{
          issuer: selectedTokenIssuer,
          tokenCode: selectedToken.tokenCode!,
          tokenType: selectedToken.tokenType,
        }}
        account={account}
        onCancel={handleCancelTokenRemoval}
        onRemoveToken={handleConfirmTokenRemoval}
        isRemovingToken={isRemovingToken}
      />;
    }

    /* eslint-disable react/jsx-no-useless-fragment */
    return <></>;
    /* eslint-enable react/jsx-no-useless-fragment */
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical={false}
      testID="simple-balances-list"
    >
      {balanceItems.map((item) => (
        <BalanceRow
          key={item.id}
          balance={item}
          rightContent={
            <ManageTokenRightContent
              token={{
                id: item.id,
                isNative: item.id === NATIVE_TOKEN_CODE,
              }}
              handleRemoveToken={() => {
                setSelectedToken(item);
                removeTokenBottomSheetModalRef.current?.present();
              }}
            />
          }
          rightSectionWidth={rightSectionWidth}
        />
      ))}
      <BottomSheet
        modalRef={removeTokenBottomSheetModalRef}
        handleCloseModal={() => {
          removeTokenBottomSheetModalRef.current?.dismiss();
        }}
        analyticsEvent={AnalyticsEvent.VIEW_REMOVE_TOKEN}
        shouldCloseOnPressBackdrop={!!selectedToken}
        customContent={renderBottomSheet()}
      />
    </ScrollView>
  );
};
