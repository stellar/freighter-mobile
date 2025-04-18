import {useCallback, useEffect, useState} from 'react';

import {createWalletKit} from 'helpers/walletKitUtil';
import { logger } from 'config/logger';

export default function useInitializeWalletKit() {
  const [initialized, setInitialized] = useState(false);
  
  const onInitialize = useCallback(async () => {
    try {
      logger.debug("useInitializeWalletKit", "Initializing walletKit ...");
      await createWalletKit();
      setInitialized(true);
    } catch (err: unknown) {
      logger.error("useInitializeWalletKit", "Error initializing walletKit: ", err);
    }
  }, []);

  useEffect(() => {
    if (!initialized) {
      onInitialize();
    }
  }, [initialized, onInitialize]);

  return initialized;
}
