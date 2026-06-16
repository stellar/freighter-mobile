import { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
} from "components/screens/SwapScreen/helpers";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { AnalyticsEvent, SwapSelectionSource } from "config/analyticsConfig";
import { FormattedSearchTokenRecord } from "config/types";
import useAppTranslation from "hooks/useAppTranslation";
import { type HeldBalanceItem } from "hooks/useBalancesList";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Keyboard } from "react-native";
import { analytics } from "services/analytics";
import { SecurityLevel } from "services/blockaid/constants";
import { SecurityWarning } from "services/blockaid/helper";

interface UseTrendingTokenDetailParams {
  balanceItems: HeldBalanceItem[];
  sourceTokenId: string;
  setSourceToken: (id: string, symbol: string) => void;
  setDestinationToken: (descriptor: DestinationTokenDescriptor | null) => void;
}

/**
 * Owns the Trending-token detail sheet and its dedicated Blockaid security
 * sheet on SwapAmountScreen.
 *
 * Two records are tracked rather than one: `selectedTrendingRecord` drives the
 * detail sheet, and `trendingSecurityRecord` is a snapshot captured when the
 * security sheet opens. Presenting the security sheet dismisses the detail
 * sheet (gorhom stacking), whose onChange(-1) nulls `selectedTrendingRecord` —
 * so the security sheet reads from the snapshot to keep its warnings + proceed
 * action stable while it's up.
 *
 * The security sheet here only commits a destination selection; it never
 * submits a transaction (that's the review-side sheet, kept separate).
 */
export const useTrendingTokenDetail = ({
  balanceItems,
  sourceTokenId,
  setSourceToken,
  setDestinationToken,
}: UseTrendingTokenDetailParams) => {
  const { t } = useAppTranslation();

  const trendingListRef = useRef<FlatList<FormattedSearchTokenRecord>>(null);
  const trendingDetailSheetRef = useRef<BottomSheetModal>(null);
  const trendingSecurityWarningBottomSheetModalRef =
    useRef<BottomSheetModal>(null);

  const [selectedTrendingRecord, setSelectedTrendingRecord] =
    useState<FormattedSearchTokenRecord | null>(null);
  const [trendingSecurityRecord, setTrendingSecurityRecord] =
    useState<FormattedSearchTokenRecord | null>(null);

  // Present the detail sheet after the record has propagated into the JSX.
  // Calling present() inline from the row press would target a sheet whose
  // ref is still null on first selection (the conditional render only runs
  // after the state update flushes).
  useEffect(() => {
    if (selectedTrendingRecord) {
      trendingDetailSheetRef.current?.present();
    }
  }, [selectedTrendingRecord]);

  // Trending row tap → open the detail sheet (dismiss the keyboard first so
  // the sheet gets full unblocked space and its CTA isn't occluded).
  const openTrendingDetail = useCallback(
    (record: FormattedSearchTokenRecord, position: number) => {
      analytics.track(AnalyticsEvent.SWAP_TRENDING_TOKEN_TAPPED, {
        tokenCode: record.tokenCode,
        tokenIssuer: record.issuer ?? "",
        position,
      });
      Keyboard.dismiss();
      setSelectedTrendingRecord(record);
    },
    [],
  );

  const clearSelectedTrendingRecord = useCallback(
    () => setSelectedTrendingRecord(null),
    [],
  );

  const clearTrendingSecurityRecord = useCallback(
    () => setTrendingSecurityRecord(null),
    [],
  );

  // Applies a trending record as the swap destination. Takes the record
  // explicitly because the two callers read from different sources: the
  // detail CTA uses the live selected record, the security sheet uses its
  // own snapshot.
  const applyTrendingSelection = useCallback(
    (record: FormattedSearchTokenRecord | null) => {
      if (!record) return;
      analytics.track(AnalyticsEvent.SWAP_TRENDING_SWAP_TO_PRESSED, {
        tokenCode: record.tokenCode,
        tokenIssuer: record.issuer ?? "",
      });
      const heldMatch = balanceItems.find(
        (b) => b.id === `${record.tokenCode}:${record.issuer}`,
      );
      const descriptor = heldMatch
        ? descriptorFromBalance(heldMatch)
        : descriptorFromSearchRecord(record);
      analytics.track(AnalyticsEvent.SWAP_DESTINATION_SELECTED, {
        tokenCode: record.tokenCode,
        tokenIssuer: descriptor.issuer ?? "",
        isNew: descriptor.isNew,
        source: SwapSelectionSource.TRENDING,
      });
      // If the new destination equals the current source, clear source so
      // the user doesn't end up with the same token on both sides.
      if (sourceTokenId && sourceTokenId === descriptor.id) {
        setSourceToken("", "");
      }
      setDestinationToken(descriptor);
      trendingListRef.current?.scrollToOffset({ offset: 0, animated: false });
      trendingDetailSheetRef.current?.dismiss();
    },
    [balanceItems, sourceTokenId, setSourceToken, setDestinationToken],
  );

  // Detail sheet "Swap to {code}" CTA.
  const confirmTrendingSelection = useCallback(
    () => applyTrendingSelection(selectedTrendingRecord),
    [applyTrendingSelection, selectedTrendingRecord],
  );

  // Detail sheet banner tap — snapshot before presenting, since presenting
  // dismisses the detail sheet and nulls selectedTrendingRecord.
  const presentTrendingSecurityWarning = useCallback(() => {
    setTrendingSecurityRecord(selectedTrendingRecord);
    trendingSecurityWarningBottomSheetModalRef.current?.present();
  }, [selectedTrendingRecord]);

  const handleCancelTrendingSecurityWarning = useCallback(() => {
    trendingSecurityWarningBottomSheetModalRef.current?.dismiss();
  }, []);

  const handleConfirmTrendingAnyway = useCallback(() => {
    trendingSecurityWarningBottomSheetModalRef.current?.dismiss();
    applyTrendingSelection(trendingSecurityRecord);
  }, [applyTrendingSelection, trendingSecurityRecord]);

  const trendingSecurityLevel = trendingSecurityRecord?.securityLevel;
  const isTrendingUnableToScan =
    trendingSecurityLevel === SecurityLevel.UNABLE_TO_SCAN;

  // Blockaid returns no feature-level warnings for an unable-to-scan token,
  // so the record's securityWarnings is empty. Synthesize the same row the
  // review-side sheet builds (useSwapSecurityAssessments) so the reasons
  // list isn't blank.
  const trendingSecurityWarnings: SecurityWarning[] = isTrendingUnableToScan
    ? [
        {
          id: "unable-to-scan-trending-token",
          description: t("blockaid.unableToScan.token"),
          severity: "warning",
        },
      ]
    : (trendingSecurityRecord?.securityWarnings ?? []);

  return {
    trendingListRef,
    trendingDetailSheetRef,
    trendingSecurityWarningBottomSheetModalRef,
    selectedTrendingRecord,
    trendingSecurityRecord,
    openTrendingDetail,
    clearSelectedTrendingRecord,
    clearTrendingSecurityRecord,
    confirmTrendingSelection,
    presentTrendingSecurityWarning,
    handleCancelTrendingSecurityWarning,
    handleConfirmTrendingAnyway,
    trendingSecurityLevel,
    isTrendingUnableToScan,
    trendingSecurityWarnings,
  };
};
