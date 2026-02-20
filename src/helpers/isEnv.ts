import Config from "react-native-config";
import { getBundleId } from "react-native-device-info";

export enum BundleIds {
  freighterProd = "org.stellar.freighterwallet",
  freighterDev = "org.stellar.freighterdev",
}

export const isDev = (getBundleId() as BundleIds) === BundleIds.freighterDev;

export const isProd = (getBundleId() as BundleIds) === BundleIds.freighterProd;

export const isE2ETest = Config.IS_E2E_TEST === "true";
