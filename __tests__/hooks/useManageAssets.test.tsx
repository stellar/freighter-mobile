import { renderHook, act } from "@testing-library/react-hooks";
import { FormattedSearchAssetRecord } from "components/screens/AddAssetScreen/types";
import { NETWORKS } from "config/constants";
import { useManageAssets } from "hooks/useManageAssets";
import {
  BuildChangeTrustTxParams,
  SignTxParams,
  SubmitTxParams,
} from "services/stellar";

const mockShowToast = jest.fn();
jest.mock("providers/ToastProvider", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string, params?: Record<string, string>) => {
    if (key === "addAssetScreen.toastSuccess") {
      return `Added ${params?.assetCode} successfully`;
    }
    if (key === "addAssetScreen.toastError") {
      return `Failed to add ${params?.assetCode}`;
    }
    if (key === "manageAssetsScreen.removeAssetSuccess") {
      return `Removed ${params?.assetCode} successfully`;
    }
    if (key === "manageAssetsScreen.removeAssetError") {
      return `Failed to remove ${params?.assetCode}`;
    }
    return key;
  },
}));

const mockBuildChangeTrustTx = jest.fn();
const mockSignTransaction = jest.fn();
const mockSubmitTx = jest.fn();

jest.mock("services/stellar", () => ({
  buildChangeTrustTx: (params: BuildChangeTrustTxParams) =>
    mockBuildChangeTrustTx(params),
  signTransaction: (params: SignTxParams) => mockSignTransaction(params),
  submitTx: (params: SubmitTxParams) => mockSubmitTx(params),
}));

jest.mock("helpers/balances", () => ({
  formatAssetIdentifier: (assetId: string) => {
    const [assetCode, issuer] = assetId.split(":");
    return { assetCode, issuer };
  },
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("useManageAssets", () => {
  const mockPublicKey =
    "GDKSXV3LBWH45YUCBWNYMYP3EBHFGECGNS5F7KHKE4OT7WOJCAPVB3K4";
  const mockPrivateKey =
    "SCFVAPOZJDQSEPQCVPAPG5ZKAJBB4QMM5XRWQVBYBGWSPHU2YPMBCHMG";
  const mockNetwork = NETWORKS.TESTNET;
  const mockOnSuccess = jest.fn();
  const mockAsset: FormattedSearchAssetRecord = {
    assetCode: "TEST",
    issuer: "GACWIA2XGDFWWN3WKPX63JTK4S2J5NDPNOIVYMZY6RVTS7LWF2VHZLV3",
    domain: "test.com",
    hasTrustline: false,
    isNative: false,
  };
  const mockXdr = "mockXdrTransaction";
  const mockSignedXdr = "mockSignedXdrTransaction";

  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildChangeTrustTx.mockResolvedValue(mockXdr);
    mockSignTransaction.mockReturnValue(mockSignedXdr);
    mockSubmitTx.mockResolvedValue({ successful: true });
  });

  describe("addAsset", () => {
    it("should successfully add an asset trustline", async () => {
      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          publicKey: mockPublicKey,
          privateKey: mockPrivateKey,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.addAsset(mockAsset);
      });

      expect(mockBuildChangeTrustTx).toHaveBeenCalledWith({
        assetIdentifier: `${mockAsset.assetCode}:${mockAsset.issuer}`,
        network: mockNetwork,
        publicKey: mockPublicKey,
      });
      expect(mockSignTransaction).toHaveBeenCalledWith({
        tx: mockXdr,
        secretKey: mockPrivateKey,
        network: mockNetwork,
      });
      expect(mockSubmitTx).toHaveBeenCalledWith({
        network: mockNetwork,
        tx: mockSignedXdr,
      });
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith({
        title: `Added ${mockAsset.assetCode} successfully`,
        variant: "success",
      });
      expect(result.current.isAddingAsset).toBe(false);
    });

    it("should handle errors when adding an asset trustline", async () => {
      mockBuildChangeTrustTx.mockRejectedValue(new Error("Network error"));
      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          publicKey: mockPublicKey,
          privateKey: mockPrivateKey,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.addAsset(mockAsset);
      });

      expect(mockBuildChangeTrustTx).toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
      expect(mockSubmitTx).not.toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith({
        title: `Failed to add ${mockAsset.assetCode}`,
        variant: "error",
      });
      expect(result.current.isAddingAsset).toBe(false);
    });

    it("should do nothing if asset is null", async () => {
      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          publicKey: mockPublicKey,
          privateKey: mockPrivateKey,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.addAsset(
          null as unknown as FormattedSearchAssetRecord,
        );
      });

      expect(mockBuildChangeTrustTx).not.toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
      expect(mockSubmitTx).not.toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockShowToast).not.toHaveBeenCalled();
    });
  });

  describe("removeAsset", () => {
    it("should successfully remove an asset trustline using string assetId", async () => {
      const mockAssetId =
        "TEST:GACWIA2XGDFWWN3WKPX63JTK4S2J5NDPNOIVYMZY6RVTS7LWF2VHZLV3";
      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          publicKey: mockPublicKey,
          privateKey: mockPrivateKey,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.removeAsset(mockAssetId);
      });

      expect(mockBuildChangeTrustTx).toHaveBeenCalledWith({
        assetIdentifier: mockAssetId,
        network: mockNetwork,
        publicKey: mockPublicKey,
        isRemove: true,
      });
      expect(mockSignTransaction).toHaveBeenCalledWith({
        tx: mockXdr,
        secretKey: mockPrivateKey,
        network: mockNetwork,
      });
      expect(mockSubmitTx).toHaveBeenCalledWith({
        network: mockNetwork,
        tx: mockSignedXdr,
      });
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith({
        title: "Removed TEST successfully",
        variant: "success",
      });
      expect(result.current.isRemovingAsset).toBe(false);
    });

    it("should successfully remove an asset trustline using FormattedSearchAssetRecord", async () => {
      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          publicKey: mockPublicKey,
          privateKey: mockPrivateKey,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.removeAsset(mockAsset);
      });

      expect(mockBuildChangeTrustTx).toHaveBeenCalledWith({
        assetIdentifier: `${mockAsset.assetCode}:${mockAsset.issuer}`,
        network: mockNetwork,
        publicKey: mockPublicKey,
        isRemove: true,
      });
      expect(mockSignTransaction).toHaveBeenCalledWith({
        tx: mockXdr,
        secretKey: mockPrivateKey,
        network: mockNetwork,
      });
      expect(mockSubmitTx).toHaveBeenCalledWith({
        network: mockNetwork,
        tx: mockSignedXdr,
      });
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith({
        title: "Removed TEST successfully",
        variant: "success",
      });
      expect(result.current.isRemovingAsset).toBe(false);
    });

    it("should handle errors when removing an asset trustline", async () => {
      mockBuildChangeTrustTx.mockRejectedValue(new Error("Network error"));
      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          publicKey: mockPublicKey,
          privateKey: mockPrivateKey,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.removeAsset(mockAsset);
      });

      expect(mockBuildChangeTrustTx).toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
      expect(mockSubmitTx).not.toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith({
        title: "Failed to remove TEST",
        variant: "error",
      });
      expect(result.current.isRemovingAsset).toBe(false);
    });
  });
});
