import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { PositionTokenRow } from "components/screens/PositionsScreen/helpers/positionRows";
import { BlendCatalogPool } from "config/blendTypes";
import {
  DEFAULT_DECIMALS,
  NETWORKS,
  mapNetworkToNetworkDetails,
} from "config/constants";
import {
  EARN_ROUTES,
  ROOT_NAVIGATOR_ROUTES,
  RootStackParamList,
} from "config/routes";
import { PricedBalanceMap } from "config/types";
import { EarnSource, useEarnStore } from "ducks/earn";
import {
  calculateSpendableAmount,
  getBalanceByContractId,
} from "helpers/balances";
import { useCallback } from "react";

/**
 * Whether the wallet has any of a token to deposit: the amount screen offers
 * nothing to enter without it, and the token picker offers Buy, Swap and
 * Receive for a token the wallet doesn't hold.
 */
export const hasSpendableBalance = ({
  assetId,
  pricedBalances,
  network,
  subentryCount,
  transactionFee,
}: {
  assetId: string;
  pricedBalances: PricedBalanceMap;
  network: NETWORKS;
  subentryCount: number;
  transactionFee: string;
}): boolean => {
  const balance = getBalanceByContractId(
    assetId,
    pricedBalances,
    mapNetworkToNetworkDetails(network),
  );
  if (!balance) {
    return false;
  }
  return calculateSpendableAmount({
    balance,
    subentryCount,
    transactionFee,
  }).gt(0);
};

/** A screen's navigation that reaches the root stack's routes. */
type RootNavigation = Pick<
  NativeStackNavigationProp<RootStackParamList>,
  "navigate"
>;

/**
 * The ways Earn opens from Home and Positions, each tagging the session with
 * where it began (the deposit events' `source`):
 * - `openEarn`: the token picker, from Home's Earn button, the Positions
 *   tab's Deposit button or its empty state's Start Earning;
 * - `depositFromPosition`: a token's Deposit, prefilled with the token and
 *   its pool so it opens on the amount screen, with the picker under it for
 *   Back, as in the extension. A token the wallet holds none of opens on the
 *   picker instead, where it offers Buy, Swap and Receive.
 */
export const useEarnEntry = (navigation: RootNavigation) => {
  const openEarn = useCallback(
    (source: EarnSource) => {
      useEarnStore.getState().setSource(source);
      navigation.navigate(ROOT_NAVIGATOR_ROUTES.EARN_STACK, {
        screen: EARN_ROUTES.EARN_TOKEN_PICKER_SCREEN,
      });
    },
    [navigation],
  );

  const depositFromPosition = useCallback(
    ({
      row,
      pool,
      canPrefill,
    }: {
      row: PositionTokenRow;
      pool: BlendCatalogPool;
      /** The wallet holds some of the token (see `hasSpendableBalance`). */
      canPrefill: boolean;
    }) => {
      if (!canPrefill) {
        openEarn("position_row");
        return;
      }

      // What the picker's token tap sets, so the amount screen finds
      // everything it reads. The catalog's decimals first, as the picker's.
      const reserve = pool.reserves.find(
        (candidate) => candidate.assetId === row.assetId,
      );
      const earn = useEarnStore.getState();
      earn.setPool(pool);
      earn.selectAsset({
        assetId: row.assetId,
        apy: row.apy,
        code: row.code,
        decimals: reserve?.decimals ?? row.decimals ?? DEFAULT_DECIMALS,
      });
      earn.setSource("position_row");

      navigation.navigate(ROOT_NAVIGATOR_ROUTES.EARN_STACK, {
        screen: EARN_ROUTES.EARN_AMOUNT_SCREEN,
        params: { assetId: row.assetId, tokenCode: row.code },
        // Mounts the picker under it, for the amount screen's way back.
        initial: false,
      });
    },
    [navigation, openEarn],
  );

  return { openEarn, depositFromPosition };
};
