import { getBundleId } from "react-native-device-info";

export enum BundleIds {
  freighterProd = "org.stellar.freighterwallet",
  freighterDev = "org.stellar.freighterdev",
}

export const isDev =
  (getBundleId() as BundleIds) === BundleIds.freighterDev || __DEV__;

export const isProd = (getBundleId() as BundleIds) === BundleIds.freighterProd;
