import { FormattedSearchAssetRecord } from "components/screens/AddAssetScreen/types";
import { NETWORKS } from "config/constants";
import { logger } from "config/logger";
import { formatAssetIdentifier } from "helpers/balances";
import useAppTranslation from "hooks/useAppTranslation";
import { ToastOptions, useToast } from "providers/ToastProvider";
import { useState } from "react";
import {
  buildChangeTrustTx,
  signTransaction,
  submitTx,
} from "services/stellar";

interface UseManageAssetsProps {
  network: NETWORKS;
  publicKey: string;
  privateKey: string;
  onSuccess?: () => void;
}

export const useManageAssets = ({
  network,
  publicKey,
  privateKey,
  onSuccess,
}: UseManageAssetsProps) => {
  const { t } = useAppTranslation();
  const { showToast } = useToast();
  const [isAddingAsset, setIsAddingAsset] = useState(false);
  const [isRemovingAsset, setIsRemovingAsset] = useState(false);

  const addAsset = async (asset: FormattedSearchAssetRecord) => {
    if (!asset) {
      return;
    }

    setIsAddingAsset(true);

    const { assetCode, issuer } = asset;

    let toastOptions: ToastOptions = {
      title: t("addAssetScreen.toastSuccess", {
        assetCode,
      }),
      variant: "success",
    };

    try {
      const addAssetTrustlineTx = await buildChangeTrustTx({
        assetIdentifier: `${assetCode}:${issuer}`,
        network,
        publicKey,
      });

      const signedTx = signTransaction({
        tx: addAssetTrustlineTx,
        secretKey: privateKey,
        network,
      });

      await submitTx({
        network,
        tx: signedTx,
      });

      onSuccess?.();
    } catch (error) {
      logger.error(
        "useManageAssets.addAsset",
        "Error adding asset trustline",
        error,
      );
      toastOptions = {
        title: t("addAssetScreen.toastError", {
          assetCode,
        }),
        variant: "error",
      };
    } finally {
      setIsAddingAsset(false);
      showToast(toastOptions);
    }
  };

  const removeAsset = async (assetId: string | FormattedSearchAssetRecord) => {
    let assetCode: string;
    let assetIdentifier: string;

    if (typeof assetId === "string") {
      const formattedAsset = formatAssetIdentifier(assetId);
      assetCode = formattedAsset.assetCode;
      assetIdentifier = assetId;
    } else {
      assetCode = assetId.assetCode;
      assetIdentifier = `${assetId.assetCode}:${assetId.issuer}`;
    }

    setIsRemovingAsset(true);

    let toastOptions: ToastOptions = {
      title: t("manageAssetsScreen.removeAssetSuccess", {
        assetCode,
      }),
      variant: "success",
    };

    try {
      const removeAssetTrustlineTx = await buildChangeTrustTx({
        assetIdentifier,
        network,
        publicKey,
        isRemove: true,
      });

      const signedTx = signTransaction({
        tx: removeAssetTrustlineTx,
        secretKey: privateKey,
        network,
      });

      await submitTx({
        network,
        tx: signedTx,
      });

      onSuccess?.();
    } catch (error) {
      logger.error(
        "useManageAssets.removeAsset",
        "Error removing asset",
        error,
      );
      toastOptions = {
        title: t("manageAssetsScreen.removeAssetError", {
          assetCode,
        }),
        variant: "error",
      };
    } finally {
      setIsRemovingAsset(false);
      showToast(toastOptions);
    }
  };

  return {
    addAsset,
    removeAsset,
    isAddingAsset,
    isRemovingAsset,
  };
};
