import { getBlendAppUrl } from "config/blend";
import { logger } from "config/logger";
import { useAuthenticationStore } from "ducks/auth";
import { useInAppBrowser } from "hooks/useInAppBrowser";
import { useCallback } from "react";

/**
 * Opens the Blend app for the active network in the in-app browser, from the
 * token picker's pool chip and the pool details sheet.
 */
export const useOpenBlendApp = () => {
  const { open } = useInAppBrowser();
  const { network } = useAuthenticationStore();

  return useCallback(() => {
    open(getBlendAppUrl(network)).catch((err) =>
      logger.error("useOpenBlendApp", "Failed to open Blend", err),
    );
  }, [open, network]);
};
