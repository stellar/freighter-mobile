import { useFocusEffect } from "@react-navigation/native";
import { logger } from "config/logger";
import { hasRecoveryPhrase } from "helpers/hasRecoveryPhrase";
import { useCallback, useState } from "react";
import { getSecretSources } from "services/auth/secretSources";

/**
 * Whether the wallet holds a recovery phrase, read from its secret sources
 * each time the screen gains focus. True until the sources have loaded and
 * when they can't be read, so a wallet with a phrase never loses the way to
 * it; only a wallet whose sources hold no phrase reads false.
 */
export const useHasRecoveryPhrase = (): boolean => {
  const [hasPhrase, setHasPhrase] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      getSecretSources()
        .then((map) => {
          if (isActive) setHasPhrase(hasRecoveryPhrase(Object.values(map)));
        })
        .catch((error: unknown) => {
          logger.error(
            "useHasRecoveryPhrase",
            "Failed to read secret sources",
            error,
          );
        });

      return () => {
        isActive = false;
      };
    }, []),
  );

  return hasPhrase;
};
