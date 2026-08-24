import Config from "react-native-config";
import { getBundleId } from "react-native-device-info";

export enum BundleIds {
  freighterProd = "org.stellar.freighterwallet",
  freighterDev = "org.stellar.freighterdev",
}

export const isDev = (getBundleId() as BundleIds) === BundleIds.freighterDev;

export const isProd = (getBundleId() as BundleIds) === BundleIds.freighterProd;

export const isE2ETest = isDev && Config.IS_E2E_TEST === "true";

/**
 * True only in builds produced by the PR Preview workflows.
 *
 * Deliberately separate from isE2ETest: that flag also suppresses Sentry,
 * changes logging, blanks the Amplitude key and enables WalletConnect test
 * helpers. A preview build wants none of that — it should behave like a normal
 * dev build apart from the specific accommodations a preview needs.
 */
export const isPreviewBuild = isDev && Config.IS_PREVIEW_BUILD === "true";
