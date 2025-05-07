import { logger } from "config/logger";
import { createWalletKit } from "helpers/walletKitUtil";
import { useCallback, useEffect, useState } from "react";

export const useWalletKitInitialize = () => {
  const [initialized, setInitialized] = useState(false);

  const onInitialize = useCallback(async () => {
    try {
      await createWalletKit();
      setInitialized(true);
    } catch (error) {
      logger.error(
        "useWalletKitInitialize",
        "Error initializing walletKit: ",
        error,
      );
      // TODO: show toast/info-box letting the user know that the walletKit initialization failed
    }
  }, []);

  useEffect(() => {
    if (!initialized) {
      onInitialize();
    }
  }, [initialized, onInitialize]);

  return initialized;
};
