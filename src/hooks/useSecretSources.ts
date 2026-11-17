import { logger } from "config/logger";
import { SecretSource } from "config/types";
import { useCallback, useState } from "react";
import { getSecretSources } from "services/auth/secretSources";

/**
 * The wallet's secret sources as a list, read when the caller runs `reload`
 * (on focus, or when the account list changes).
 *
 * `sources` stays null until the first read lands, so a caller can hold off
 * on grouping rather than draw the list ungrouped and regroup it. A failed
 * read is logged under `logContext` and keeps the last good list, or falls
 * back to [] when there is none, so the accounts still show.
 */
const useSecretSources = (logContext: string) => {
  const [sources, setSources] = useState<SecretSource[] | null>(null);

  const reload = useCallback(() => {
    getSecretSources()
      .then((map) => setSources(Object.values(map)))
      .catch((error) => {
        logger.error(logContext, "Failed to read secret sources", error);
        setSources((current) => current ?? []);
      });
  }, [logContext]);

  return { sources, reload };
};

export default useSecretSources;
