import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BigNumber from "bignumber.js";
import { BalanceRow } from "components/BalanceRow";
import BottomSheet from "components/BottomSheet";
import ManageTokenRightContent from "components/ManageTokenRightContent";
import CannotRemoveTokenBottomSheet, {
  CannotRemoveType,
} from "components/screens/AddTokenScreen/CannotRemoveTokenBottomSheet";
import RemoveTokenBottomSheetContent from "components/screens/AddTokenScreen/RemoveTokenBottomSheet";
import { AnalyticsEvent } from "config/analyticsConfig";
import { NATIVE_TOKEN_CODE, NETWORKS } from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { getIssuerFromIdentifier } from "helpers/balances";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useManageToken } from "hooks/useManageToken";
import React, { useCallback, useRef, useState } from "react";
import { ScrollView } from "react-native";
import { analytics } from "services/analytics";

type UseBalanceList = ReturnType<typeof useBalancesList>;
type Balance = UseBalanceList["balanceItems"][number];

interface SimpleBalancesListProps {
  publicKey: string;
  network: NETWORKS;
  rightSectionWidth?: number;
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
}) => {
  const removeTokenBottomSheetModalRef = useRef<BottomSheetModal>(null);
  const { account } = useGetActiveAccount();
  const [selectedToken, setSelectedToken] = useState<Balance | null>(null);

  const { balanceItems, handleRefresh } = useBalancesList({
    publicKey,
    network,
  });

  const { removeToken, isRemovingToken } = useManageToken({
    token: selectedToken
      ? {
          type: selectedToken.tokenType,
          code: selectedToken.tokenCode!,
          id: selectedToken.id,
          issuer: getIssuerFromIdentifier(selectedToken.id),
        }
      : null,
    network,
    account,
    bottomSheetRefRemove: removeTokenBottomSheetModalRef,
    onSuccess: handleRefresh,
  });

  const handleCancelTokenRemoval = useCallback(() => {
    if (selectedToken) {
      analytics.trackRemoveTokenRejected(selectedToken.tokenCode);
    }

    removeTokenBottomSheetModalRef.current?.dismiss();
  }, [selectedToken]);

  const getBottomSheetCustomContent = useCallback(() => {
    const isLpShare = selectedToken
      ? selectedToken.tokenType ===
        TokenTypeWithCustomToken.LIQUIDITY_POOL_SHARES
      : false;
    const selectedTokenIssuer =
      selectedToken &&
      "token" in selectedToken &&
      "issuer" in selectedToken.token
        ? selectedToken.token.issuer.key
        : NATIVE_TOKEN_CODE;
    if (
      selectedToken &&
      selectedTokenIssuer === NATIVE_TOKEN_CODE &&
      !isLpShare
    ) {
      return (
        <CannotRemoveTokenBottomSheet
          type={CannotRemoveType.native}
          onDismiss={() => {
            removeTokenBottomSheetModalRef.current?.dismiss();
          }}
        />
      );
    }

    const hasBalance = selectedToken
      ? selectedToken?.total.isGreaterThan(new BigNumber(0))
      : false;

    if (hasBalance || isLpShare) {
      return (
        <CannotRemoveTokenBottomSheet
          type={CannotRemoveType.hasBalance}
          onDismiss={() => {
            removeTokenBottomSheetModalRef.current?.dismiss();
          }}
        />
      );
    }

    if (selectedToken && selectedTokenIssuer) {
      return (
        <RemoveTokenBottomSheetContent
          token={{
            issuer: selectedTokenIssuer,
            tokenCode: selectedToken.tokenCode!,
            tokenType: selectedToken.tokenType,
          }}
          account={account}
          onCancel={handleCancelTokenRemoval}
          onRemoveToken={removeToken}
          isRemovingToken={isRemovingToken}
        />
      );
    }

    /* eslint-disable react/jsx-no-useless-fragment */
    return <></>;
    /* eslint-enable react/jsx-no-useless-fragment */
  }, [
    account,
    handleCancelTokenRemoval,
    removeToken,
    isRemovingToken,
    removeTokenBottomSheetModalRef,
    selectedToken,
  ]);

  if (!balanceItems.length) {
    return null;
  }

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
        customContent={getBottomSheetCustomContent()}
      />
    </ScrollView>
  );
};
