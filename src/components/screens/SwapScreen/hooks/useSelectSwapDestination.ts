import {
  descriptorFromBalance,
  descriptorFromSearchRecord,
  withTokenDecimals,
} from "components/screens/SwapScreen/helpers";
import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import { AnalyticsEvent, SwapSelectionSource } from "config/analyticsConfig";
import { FormattedSearchTokenRecord } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useSwapStore } from "ducks/swap";
import useAppTranslation from "hooks/useAppTranslation";
import { useBalancesList } from "hooks/useBalancesList";
import useGetActiveAccount from "hooks/useGetActiveAccount";
import { useToast } from "providers/ToastProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import { analytics } from "services/analytics";

interface UseSelectSwapDestinationParams {
  /** Undefined when the screen was not opened from the swap amount screen; `select` is then a no-op. Keeps the hook unconditional in the screen. */
  record: FormattedSearchTokenRecord | undefined;
  /** Called after the store is updated; the screen pops back here. */
  onSelected: () => void;
}

/** Makes a search record the swap destination, reading decimals first for a Soroban token. */
export const useSelectSwapDestination = ({
  record,
  onSelected,
}: UseSelectSwapDestinationParams): {
  select: () => void;
  isPending: boolean;
} => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const { account } = useGetActiveAccount();
  const { network } = useAuthenticationStore();
  const publicKey = account?.publicKey ?? "";
  const { balanceItems } = useBalancesList({ publicKey, network });

  const [isPending, setIsPending] = useState(false);
  // A Soroban pick can wait on /token-details; these let a newer pick, a
  // pick made elsewhere, or leaving the screen win over its late result.
  const pickIdRef = useRef(0);
  const pendingPickRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const select = useCallback(() => {
    if (!record) return;
    analytics.track(AnalyticsEvent.SWAP_TRENDING_SWAP_TO_PRESSED, {
      tokenCode: record.tokenCode,
      tokenIssuer: record.issuer ?? "",
    });
    const heldMatch = balanceItems.find(
      (b) =>
        b.id === `${record.tokenCode}:${record.issuer}` ||
        ("contractId" in b && b.contractId === record.issuer),
    );
    const apply = (descriptor: DestinationTokenDescriptor) => {
      analytics.track(AnalyticsEvent.SWAP_DESTINATION_SELECTED, {
        asset_code: record.tokenCode,
        asset_issuer: descriptor.issuer ?? "",
        requires_trustline: descriptor.requiresTrustline,
        source: SwapSelectionSource.TRENDING,
      });
      const { sourceTokenId, setSourceToken, setDestinationToken } =
        useSwapStore.getState();
      // If the new destination equals the current source, clear source so
      // the user doesn't end up with the same token on both sides.
      if (sourceTokenId && sourceTokenId === descriptor.id) {
        setSourceToken("", "");
      }
      setDestinationToken(descriptor);
      onSelected();
    };
    if (heldMatch) {
      apply(descriptorFromBalance(heldMatch));
      return;
    }
    const recordId = `${record.tokenCode}:${record.issuer}`;
    if (pendingPickRef.current === recordId) return;
    pickIdRef.current += 1;
    const pickId = pickIdRef.current;
    pendingPickRef.current = recordId;
    setIsPending(true);
    const pickedFrom = useSwapStore.getState();
    // Only the latest pick, made while the screen is still up, may apply,
    // and not over a pick made elsewhere while it was loading.
    const isCurrent = () => {
      if (pickId !== pickIdRef.current || !isMountedRef.current) return false;
      pendingPickRef.current = null;
      setIsPending(false);
      const now = useSwapStore.getState();
      return (
        now.sourceTokenId === pickedFrom.sourceTokenId &&
        now.destinationToken?.id === pickedFrom.destinationToken?.id
      );
    };
    withTokenDecimals(
      record,
      { publicKey, network },
      (resolved) => {
        if (isCurrent()) apply(descriptorFromSearchRecord(resolved));
      },
      () => {
        if (!isCurrent()) return;
        showToast({
          variant: "error",
          title: t("swapScreen.errors.tokenDetailsUnavailable"),
          toastId: "swap-token-details-unavailable",
        });
      },
    );
  }, [record, balanceItems, onSelected, publicKey, network, showToast, t]);

  return { select, isPending };
};
