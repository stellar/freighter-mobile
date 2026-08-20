import Blockaid from "@blockaid/client";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useBlockaidTransaction } from "hooks/blockaid/useBlockaidTransaction";
import useAppTranslation from "hooks/useAppTranslation";
import { useCallback, useState } from "react";

export interface SimulateEarnDepositParams {
  assetId: string;
  amount: string;
  decimals: number;
  transactionFee: string;
  transactionTimeout: number;
  network: NETWORKS;
  senderAddress: string;
}

export interface SimulateEarnDepositSuccess {
  preparedXdr: string;
  /** `undefined` when the scan failed or was unavailable (e.g. testnet) —
   *  callers should treat that the same as "unable to scan", never as a
   *  reason to fail the deposit. */
  scanResult: Blockaid.StellarTransactionScanResponse | undefined;
}

/**
 * Builds, simulates and scans a Blend deposit.
 *
 * The prepared XDR lands in the transactionBuilder duck, which is where the
 * submit step reads it from — this hook returns only what the amount screen
 * needs to decide whether to open Review.
 *
 * IMPORTANT — the Blockaid scan is isolated in its own try/catch, separate
 * from the simulation above it. `scanTransaction` (services/blockaid/api)
 * THROWS `NETWORK_NOT_SUPPORTED` whenever the active network isn't mainnet,
 * which is the common case on TESTNET. If the scan shared the simulation's
 * try/catch, every testnet deposit would report "simulation failed" even
 * though the deposit itself simulated fine and only the security scan was
 * unavailable. A scan failure therefore never fails `simulate` — it resolves
 * with `scanResult: undefined`, which downstream security-assessment helpers
 * (e.g. `assessTransactionSecurity`) already treat as "unable to scan".
 */
export const useSimulateEarnDeposit = () => {
  const buildBlendDepositTransaction = useTransactionBuilderStore(
    (state) => state.buildBlendDepositTransaction,
  );
  const { scanTransaction } = useBlockaidTransaction();
  const { t } = useAppTranslation();

  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<
    Blockaid.StellarTransactionScanResponse | undefined
  >(undefined);

  const simulate = useCallback(
    async (
      params: SimulateEarnDepositParams,
    ): Promise<SimulateEarnDepositSuccess | null> => {
      setIsSimulating(true);
      setError(null);
      setScanResult(undefined);

      try {
        const preparedXdr = await buildBlendDepositTransaction(params);

        if (!preparedXdr) {
          // The duck already recorded WHY (a supply cap, frozen pool, or
          // stale oracle rejection from simulation) — surface that directly
          // rather than a generic message, since it is the only signal the
          // user gets about why the deposit will not go through.
          throw new Error(
            useTransactionBuilderStore.getState().error ||
              t("earnAmount.errors.simulationFailed"),
          );
        }

        // Scanned on the PREPARED (assembled) transaction — the thing the
        // user actually signs — not the pre-assembly build. Deliberately its
        // own try/catch: see the function-level note above on why a scan
        // failure must never fail the simulation.
        let freshScanResult:
          | Blockaid.StellarTransactionScanResponse
          | undefined;
        try {
          freshScanResult = await scanTransaction(preparedXdr, "internal");
        } catch (scanError) {
          logger.error(
            "useSimulateEarnDeposit",
            "Transaction scan failed",
            scanError,
          );
          freshScanResult = undefined;
        }

        setScanResult(freshScanResult);
        return { preparedXdr, scanResult: freshScanResult };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("useSimulateEarnDeposit", "Simulation failed", err);
        setError(message);
        return null;
      } finally {
        setIsSimulating(false);
      }
    },
    [buildBlendDepositTransaction, scanTransaction, t],
  );

  return { simulate, isSimulating, error, scanResult };
};
