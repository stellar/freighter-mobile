/**
 * Local feature flags for gating features that are in development.
 * These are compile-time constants — not remotely configurable.
 * For remote feature flags, see `ducks/remoteConfig.ts`.
 */
export const featureFlags = {
  isContactListEnabled: false,
} as const;
