import { DestinationTokenDescriptor } from "components/screens/SwapScreen/helpers/types";
import {
  DEFAULT_DECIMALS,
  DEFAULT_SWAP_DEST_TOKEN_ID,
  NATIVE_TOKEN_CODE,
  NETWORKS,
} from "config/constants";
import { TokenTypeWithCustomToken } from "config/types";
import { useBalancesStore } from "ducks/balances";
import { useSwapStore } from "ducks/swap";
import { useEffect, useRef } from "react";
import { scanToken } from "services/blockaid/api";
import {
  assessTokenSecurity,
  extractSecurityWarnings,
} from "services/blockaid/helper";

/**
 * Seeds the swap destination with the network's default token (#940), or
 * native XLM when the swap already starts from the default. Seeds once per
 * mount and never overrides a destination the user picked or cleared.
 *
 * - Waits for a balances snapshot stamped for the active account/network
 *   (a network switch keeps the stale snapshot around) and derives
 *   `requiresTrustline` from the raw balances map, which is written in the
 *   same store update as the stamps.
 * - Stamps a non-held default with its own Blockaid scan once it resolves;
 *   without a securityLevel the review flow would treat it as "unable to
 *   scan". Scan failure (Blockaid only covers mainnet) leaves it unstamped
 *   and the standard unable-to-scan flow applies.
 *
 * Call it AFTER the effect that initializes the source token from route
 * params, so seeding observes the destination that effect just cleared.
 */
export const useDefaultSwapDestination = ({
  network,
  publicKey,
  swapFromTokenId,
  destinationTokenDescriptor,
  setDestinationToken,
}: {
  network: NETWORKS;
  publicKey: string | undefined;
  swapFromTokenId: string | undefined;
  destinationTokenDescriptor: DestinationTokenDescriptor | null;
  setDestinationToken: (descriptor: DestinationTokenDescriptor | null) => void;
}): void => {
  const rawBalances = useBalancesStore((state) => state.balances);
  const balancesFetchedPublicKey = useBalancesStore(
    (state) => state.fetchedPublicKey,
  );
  const balancesFetchedNetwork = useBalancesStore(
    (state) => state.fetchedNetwork,
  );

  const hasSeededDefaultDestination = useRef(false);
  useEffect(() => {
    if (hasSeededDefaultDestination.current) {
      return;
    }
    const defaultTokenId = DEFAULT_SWAP_DEST_TOKEN_ID[network];
    if (!defaultTokenId || destinationTokenDescriptor) {
      hasSeededDefaultDestination.current = true;
      return;
    }
    if (
      !publicKey ||
      balancesFetchedPublicKey !== publicKey ||
      balancesFetchedNetwork !== network
    ) {
      return;
    }
    hasSeededDefaultDestination.current = true;

    if (swapFromTokenId === defaultTokenId) {
      setDestinationToken({
        id: NATIVE_TOKEN_CODE,
        tokenCode: NATIVE_TOKEN_CODE,
        decimals: DEFAULT_DECIMALS,
        tokenType: TokenTypeWithCustomToken.NATIVE,
        requiresTrustline: false,
      });
      return;
    }

    const isDefaultHeld = defaultTokenId in rawBalances;
    const [defaultTokenCode, defaultTokenIssuer] = defaultTokenId.split(":");
    setDestinationToken({
      id: defaultTokenId,
      tokenCode: defaultTokenCode,
      issuer: defaultTokenIssuer,
      decimals: DEFAULT_DECIMALS,
      tokenType: TokenTypeWithCustomToken.CREDIT_ALPHANUM4,
      requiresTrustline: !isDefaultHeld,
    });

    if (isDefaultHeld) {
      // Already-held tokens get their security signal from the held-balances
      // bulk scan, so there's nothing to attach here.
      return;
    }

    scanToken({
      tokenCode: defaultTokenCode,
      tokenIssuer: defaultTokenIssuer,
      network,
    })
      .then((scanResult) => {
        // Read the destination synchronously from the store: render state
        // (props or a render-synced ref) can lag a store write from the
        // picker, and resetSwap on unmount nulls it before a late scan
        // resolves. Only update if the destination is still our seeded
        // default and nothing has stamped it yet. If the user picked
        // another token in the meantime, that one brought its own scan
        // result.
        const current = useSwapStore.getState().destinationToken;
        if (current?.id !== defaultTokenId || current.securityLevel) {
          return;
        }
        setDestinationToken({
          ...current,
          securityLevel: assessTokenSecurity(scanResult).level,
          securityWarnings: extractSecurityWarnings(scanResult),
        });
      })
      .catch(() => {
        // If scan failed, leave the descriptor unstamped so the regular
        // unable-to-scan warning flow takes over.
      });
  }, [
    network,
    destinationTokenDescriptor,
    rawBalances,
    balancesFetchedPublicKey,
    balancesFetchedNetwork,
    publicKey,
    swapFromTokenId,
    setDestinationToken,
  ]);
};
