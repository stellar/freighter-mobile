import { updateSentryContext } from "config/sentryConfig";
import { useAnalyticsStore } from "ducks/analytics";
import { useAuthenticationStore } from "ducks/auth";
import { useEffect } from "react";

/**
 * Hook that automatically updates Sentry context and tags when relevant state changes
 *
 * This hook monitors authentication and analytics state changes and updates
 * Sentry context accordingly. It ensures that Sentry always has the most
 * current user information for error tracking and debugging.
 *
 * @example
 * ```tsx
 * function App() {
 *   useSentryContext();
 *   return <YourApp />;
 * }
 * ```
 */
export const useSentryContext = (): void => {
  const { isEnabled: analyticsEnabled } = useAnalyticsStore();
  const { account, authStatus } = useAuthenticationStore();

  useEffect(() => {
    // Update Sentry context whenever analytics preferences change
    updateSentryContext();
  }, [analyticsEnabled]);

  useEffect(() => {
    // Update Sentry context whenever authentication state changes
    updateSentryContext();
  }, [account, authStatus]);
};
