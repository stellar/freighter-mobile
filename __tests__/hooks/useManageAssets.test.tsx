import { act, renderHook } from "@testing-library/react-hooks";
import { DEFAULT_DECIMALS, NETWORKS, STORAGE_KEYS } from "config/constants";
import {
  AssetTypeWithCustomToken,
  CustomTokenStorage,
  FormattedSearchAssetRecord,
} from "config/types";
import { useManageAssets } from "hooks/useManageAssets";
import {
  BuildChangeTrustTxParams,
  SignTxParams,
  SubmitTxParams,
} from "services/stellar";

// Mock all timers
jest.useFakeTimers();

// Mock setTimeout to execute callbacks immediately
jest.spyOn(global, "setTimeout").mockImplementation((callback: () => void) => {
  callback();
  return 0 as unknown as NodeJS.Timeout;
});

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
    Promise.resolve(mockBuildChangeTrustTx(params)),
  signTransaction: (params: SignTxParams) => mockSignTransaction(params),
  submitTx: (params: SubmitTxParams) => Promise.resolve(mockSubmitTx(params)),
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

// Mock storage
let mockStorage: Record<string, string> = {};
const mockGetItem = jest.fn((key: string) =>
  Promise.resolve(mockStorage[key] || null),
);
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStorage[key] = value;
  return Promise.resolve();
});

jest.mock("services/storage/storageFactory", () => ({
  dataStorage: {
    getItem: (key: string) => mockGetItem(key),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));

describe("useManageAssets", () => {
  const mockPublicKey =
    "GDKSXV3LBWH45YUCBWNYMYP3EBHFGECGNS5F7KHKE4OT7WOJCAPVB3K4";
  const mockPrivateKey =
    "SCFVAPOZJDQSEPQCVPAPG5ZKAJBB4QMM5XRWQVBYBGWSPHU2YPMBCHMG";
  const mockAccount = {
    publicKey: mockPublicKey,
    privateKey: mockPrivateKey,
    accountName: "test",
    id: "test",
    subentryCount: 0,
  };
  const mockNetwork = NETWORKS.TESTNET;
  const mockOnSuccess = jest.fn();
  const mockOnComplete = jest.fn();
  const mockAsset: FormattedSearchAssetRecord = {
    assetCode: "TEST",
    issuer: "GACWIA2XGDFWWN3WKPX63JTK4S2J5NDPNOIVYMZY6RVTS7LWF2VHZLV3",
    domain: "test.com",
    hasTrustline: false,
    isNative: false,
  };
  const mockCustomAsset: FormattedSearchAssetRecord = {
    assetCode: "CUSTOM",
    issuer: "GACWIA2XGDFWWN3WKPX63JTK4S2J5NDPNOIVYMZY6RVTS7LWF2VHZLV3",
    domain: "custom.com",
    hasTrustline: false,
    isNative: false,
    assetType: AssetTypeWithCustomToken.CUSTOM_TOKEN,
    decimals: 6,
    name: "Custom Token",
  };
  const mockXdr = "mockXdrTransaction";
  const mockSignedXdr = "mockSignedXdrTransaction";

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = {};
    mockBuildChangeTrustTx.mockReturnValue(mockXdr);
    mockSignTransaction.mockReturnValue(mockSignedXdr);
    mockSubmitTx.mockReturnValue({ successful: true });

    // Clear all timeouts
    jest.clearAllTimers();
  });

  describe("addAsset", () => {
    it("should successfully add an asset trustline", async () => {
      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          account: mockAccount,
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

    it("should successfully add an asset trustline and call onComplete", async () => {
      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          account: mockAccount,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.addAsset(mockAsset, mockOnComplete);
      });

      expect(mockBuildChangeTrustTx).toHaveBeenCalled();
      expect(mockSignTransaction).toHaveBeenCalled();
      expect(mockSubmitTx).toHaveBeenCalled();
      expect(mockOnComplete).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it("should successfully add a custom token", async () => {
      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          account: mockAccount,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.addAsset(mockCustomAsset);
      });

      // Custom token should not use trustlines
      expect(mockBuildChangeTrustTx).not.toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
      expect(mockSubmitTx).not.toHaveBeenCalled();

      // Verify storage operations
      expect(mockSetItem).toHaveBeenCalled();
      const [storageKey, storageValue] = mockSetItem.mock.calls[0];
      const storageData = JSON.parse(storageValue) as CustomTokenStorage;

      expect(storageKey).toBe(STORAGE_KEYS.CUSTOM_TOKEN_LIST);
      expect(storageData[mockPublicKey]).toBeDefined();
      expect(storageData[mockPublicKey][mockNetwork]).toBeDefined();
      expect(storageData[mockPublicKey][mockNetwork].length).toBe(1);
      expect(storageData[mockPublicKey][mockNetwork][0]).toEqual({
        contractId: mockCustomAsset.issuer,
        symbol: mockCustomAsset.assetCode,
        decimals: mockCustomAsset.decimals ?? DEFAULT_DECIMALS,
        name: mockCustomAsset.name ?? mockCustomAsset.assetCode,
      });

      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith({
        title: `Added ${mockCustomAsset.assetCode} successfully`,
        variant: "success",
      });
      expect(result.current.isAddingAsset).toBe(false);
    });

    it("should handle errors when adding an asset trustline", async () => {
      mockBuildChangeTrustTx.mockImplementationOnce(() =>
        Promise.reject(new Error("Network error")),
      );

      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          account: mockAccount,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        try {
          await result.current.addAsset(mockAsset);
        } catch (error) {
          // Error is expected
        }
      });

      // Run all timers to handle the setTimeout in finally block
      jest.runAllTimers();

      expect(mockBuildChangeTrustTx).toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
      expect(mockSubmitTx).not.toHaveBeenCalled();
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
          account: mockAccount,
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
          account: mockAccount,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.removeAsset({ assetId: mockAssetId });
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
          account: mockAccount,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.removeAsset({ assetRecord: mockAsset });
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

    it("should successfully remove an asset trustline and call onComplete", async () => {
      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          account: mockAccount,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.removeAsset({
          assetRecord: mockAsset,
          onComplete: mockOnComplete,
        });
      });

      expect(mockBuildChangeTrustTx).toHaveBeenCalled();
      expect(mockSignTransaction).toHaveBeenCalled();
      expect(mockSubmitTx).toHaveBeenCalled();
      expect(mockOnComplete).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it("should successfully remove a custom token", async () => {
      // Setup initial storage with a custom token
      const initialStorage: CustomTokenStorage = {
        [mockPublicKey]: {
          [mockNetwork]: [
            {
              contractId: mockCustomAsset.issuer,
              symbol: mockCustomAsset.assetCode,
              decimals: mockCustomAsset.decimals ?? DEFAULT_DECIMALS,
              name: mockCustomAsset.name ?? mockCustomAsset.assetCode,
            },
          ],
        },
      };

      // Set up initial storage state
      mockStorage[STORAGE_KEYS.CUSTOM_TOKEN_LIST] =
        JSON.stringify(initialStorage);

      // Mock storage implementation
      mockGetItem.mockImplementation((key) => {
        if ((key as STORAGE_KEYS) === STORAGE_KEYS.CUSTOM_TOKEN_LIST) {
          return Promise.resolve(mockStorage[key] || null);
        }
        return Promise.resolve(null);
      });

      mockSetItem.mockImplementation((key, value) => {
        mockStorage[key] = value;
        return Promise.resolve();
      });

      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          account: mockAccount,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.removeAsset({
          assetRecord: mockCustomAsset,
          assetType: AssetTypeWithCustomToken.CUSTOM_TOKEN,
        });
      });

      // Run all timers to handle the setTimeout in finally block
      jest.runAllTimers();

      // Custom token should not use trustlines
      expect(mockBuildChangeTrustTx).not.toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
      expect(mockSubmitTx).not.toHaveBeenCalled();

      // Verify storage operations
      expect(mockSetItem).toHaveBeenCalled();
      const [storageKey, storageValue] = mockSetItem.mock.calls[0];
      const storageData = JSON.parse(storageValue) as CustomTokenStorage;

      expect(storageKey).toBe(STORAGE_KEYS.CUSTOM_TOKEN_LIST);
      expect(storageData[mockPublicKey]).toBeUndefined();

      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith({
        title: `Removed ${mockCustomAsset.assetCode} successfully`,
        variant: "success",
      });
      expect(result.current.isRemovingAsset).toBe(false);
    });

    it("should handle cleanup when removing the last custom token for a network", async () => {
      // Setup initial storage with a custom token
      const initialStorage: CustomTokenStorage = {
        [mockPublicKey]: {
          [mockNetwork]: [
            {
              contractId: mockCustomAsset.issuer,
              symbol: mockCustomAsset.assetCode,
              decimals: mockCustomAsset.decimals ?? DEFAULT_DECIMALS,
              name: mockCustomAsset.name ?? mockCustomAsset.assetCode,
            },
          ],
        },
      };

      // Set up initial storage state
      mockStorage[STORAGE_KEYS.CUSTOM_TOKEN_LIST] =
        JSON.stringify(initialStorage);

      // Mock storage implementation
      mockGetItem.mockImplementation((key) => {
        if ((key as STORAGE_KEYS) === STORAGE_KEYS.CUSTOM_TOKEN_LIST) {
          return Promise.resolve(mockStorage[key] || null);
        }
        return Promise.resolve(null);
      });

      mockSetItem.mockImplementation((key, value) => {
        mockStorage[key] = value;
        return Promise.resolve();
      });

      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          account: mockAccount,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.removeAsset({
          assetRecord: mockCustomAsset,
          assetType: AssetTypeWithCustomToken.CUSTOM_TOKEN,
        });
      });

      // Run all timers to handle the setTimeout in finally block
      jest.runAllTimers();

      // Verify storage cleanup
      const [, storageValue] = mockSetItem.mock.calls[0];
      const storageData = JSON.parse(storageValue) as CustomTokenStorage;

      expect(storageData[mockPublicKey]).toBeUndefined();
    });

    it("should handle cleanup when removing the last network for a public key", async () => {
      // Setup initial storage with only one network and token
      const initialStorage: CustomTokenStorage = {
        [mockPublicKey]: {
          [mockNetwork]: [
            {
              contractId: mockCustomAsset.issuer,
              symbol: mockCustomAsset.assetCode,
              decimals: mockCustomAsset.decimals ?? DEFAULT_DECIMALS,
              name: mockCustomAsset.name ?? mockCustomAsset.assetCode,
            },
          ],
        },
      };
      mockStorage[STORAGE_KEYS.CUSTOM_TOKEN_LIST] =
        JSON.stringify(initialStorage);

      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          account: mockAccount,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        await result.current.removeAsset({
          assetRecord: mockCustomAsset,
          assetType: AssetTypeWithCustomToken.CUSTOM_TOKEN,
        });
      });

      // Verify storage cleanup
      const [, storageValue] = mockSetItem.mock.calls[0];
      const storageData = JSON.parse(storageValue) as CustomTokenStorage;

      expect(storageData[mockPublicKey]).toBeUndefined();
    });

    it("should handle errors when removing an asset trustline", async () => {
      mockBuildChangeTrustTx.mockImplementationOnce(() =>
        Promise.reject(new Error("Network error")),
      );

      const { result } = renderHook(() =>
        useManageAssets({
          network: mockNetwork,
          account: mockAccount,
          onSuccess: mockOnSuccess,
        }),
      );

      await act(async () => {
        try {
          await result.current.removeAsset({ assetRecord: mockAsset });
        } catch (error) {
          // Error is expected
        }
      });

      // Run all timers to handle the setTimeout in finally block
      jest.runAllTimers();

      expect(mockBuildChangeTrustTx).toHaveBeenCalled();
      expect(mockSignTransaction).not.toHaveBeenCalled();
      expect(mockSubmitTx).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith({
        title: "Failed to remove TEST",
        variant: "error",
      });
      expect(result.current.isRemovingAsset).toBe(false);
    });
  });
});
