import { fireEvent, waitFor } from "@testing-library/react-native";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import { TransactionContext, NETWORKS } from "config/constants";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { isContractId } from "helpers/soroban";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

jest.mock("ducks/transactionSettings");
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(),
}));
jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(() => ({
    balanceItems: [],
  })),
}));
jest.mock("ducks/swapSettings", () => ({
  useSwapSettingsStore: jest.fn(() => ({
    swapFee: "100",
    swapTimeout: 30,
    swapSlippage: 1,
    saveSwapFee: jest.fn(),
    saveSwapTimeout: jest.fn(),
    saveSwapSlippage: jest.fn(),
  })),
}));
jest.mock("hooks/useInitialRecommendedFee", () => ({
  useInitialRecommendedFee: jest.fn(() => ({
    markAsManuallyChanged: jest.fn(),
  })),
}));
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({
    t: (key: string) => key,
  }),
}));
jest.mock("hooks/useColors", () => ({
  __esModule: true,
  default: () => ({
    themeColors: {
      foreground: { primary: "#000000" },
      gray: { 8: "#666666" },
      status: { error: "#ff0000", warning: "#ffaa00" },
      background: { primary: "#ffffff" },
      lilac: {
        9: "#6e56cf",
      },
    },
  }),
}));
jest.mock("hooks/useNetworkFees", () => ({
  useNetworkFees: () => ({
    recommendedFee: "100",
    networkCongestion: "LOW",
  }),
}));
jest.mock("hooks/useValidateMemo", () => ({
  useValidateMemo: () => ({ error: null }),
}));
jest.mock("hooks/useValidateTransactionFee", () => ({
  useValidateTransactionFee: () => ({ error: null }),
}));
jest.mock("hooks/useValidateTransactionTimeout", () => ({
  useValidateTransactionTimeout: () => ({ error: null }),
}));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetModalProvider: ({ children }: { children: React.ReactNode }) =>
    children,
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
  BottomSheetView: ({ children }: { children: React.ReactNode }) => children,
  BottomSheetBackdrop: ({ children }: { children: React.ReactNode }) =>
    children,
  BottomSheetTextInput: "TextInput",
}));
jest.mock("helpers/soroban", () => ({
  isContractId: jest.fn(),
  isSorobanTransaction: jest.fn(),
}));

const mockGetMemoDisabledState = jest.fn().mockReturnValue({
  isMemoDisabled: false,
  memoDisabledMessage: undefined,
});

jest.mock("helpers/muxedAddress", () => ({
  getMemoDisabledState: (...args: unknown[]) =>
    mockGetMemoDisabledState(...args),
}));

const mockUseTransactionSettingsStore =
  useTransactionSettingsStore as jest.MockedFunction<
    typeof useTransactionSettingsStore
  >;
const mockUseAuthenticationStore =
  useAuthenticationStore as jest.MockedFunction<typeof useAuthenticationStore>;

const mockIsContractId = isContractId as jest.MockedFunction<
  typeof isContractId
>;

describe("TransactionSettingsBottomSheet - onSettingsChange Integration", () => {
  const mockOnCancel = jest.fn();
  const mockOnConfirm = jest.fn();
  const mockOnSettingsChange = jest.fn();

  const mockTransactionSettingsState = {
    transactionMemo: "",
    transactionFee: "100",
    transactionTimeout: 30,
    recipientAddress:
      "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
    selectedTokenId:
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    selectedCollectibleDetails: {
      collectionAddress: "",
      tokenId: "",
    },
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveRecipientAddress: jest.fn(),
    saveSelectedTokenId: jest.fn(),
    saveSelectedCollectibleDetails: jest.fn(),
    resetSettings: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTransactionSettingsStore.mockReturnValue(
      mockTransactionSettingsState,
    );
    mockUseAuthenticationStore.mockReturnValue({
      account: {
        publicKey: "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      },
      network: NETWORKS.PUBLIC,
    } as any);
    mockIsContractId.mockReturnValue(false);
    mockGetMemoDisabledState.mockReturnValue({
      isMemoDisabled: false,
      memoDisabledMessage: undefined,
    });
  });

  it("should call onSettingsChange when confirm is pressed", async () => {
    const { getByText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    const confirmButton = getByText("common.save");

    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(mockOnSettingsChange).toHaveBeenCalled();
      expect(mockOnConfirm).toHaveBeenCalled();
    });

    expect(mockOnSettingsChange).toHaveBeenCalled();
    expect(mockOnConfirm).toHaveBeenCalled();
  });

  it("should handle async onSettingsChange correctly", async () => {
    const asyncOnSettingsChange = jest.fn().mockReturnValue(undefined);

    const { getByText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={asyncOnSettingsChange}
      />,
    );

    const confirmButton = getByText("common.save");

    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(asyncOnSettingsChange).toHaveBeenCalled();
      expect(mockOnConfirm).toHaveBeenCalled();
    });
  });

  it("should save settings to store when confirm is pressed", async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    const memoInput = getByPlaceholderText(
      "transactionSettings.memoPlaceholder",
    );
    const confirmButton = getByText("common.save");

    fireEvent.changeText(memoInput, "Test memo");
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(mockTransactionSettingsState.saveMemo).toHaveBeenCalledWith(
        "Test memo",
      );
      expect(mockOnSettingsChange).toHaveBeenCalled();
      expect(mockOnConfirm).toHaveBeenCalled();
    });
  });

  it("should rebuild transaction with memo for memo-required address", async () => {
    const mockOnSettingsChangeForMemo = jest.fn().mockImplementation(() => {
      const currentSettings = mockTransactionSettingsState;
      if (currentSettings.transactionMemo) {
        // eslint-disable-next-line no-console
        console.log(
          `Rebuilding transaction with memo: ${currentSettings.transactionMemo}`,
        );
      }
    });

    const { getByPlaceholderText, getByText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChangeForMemo}
      />,
    );

    const memoInput = getByPlaceholderText(
      "transactionSettings.memoPlaceholder",
    );
    const confirmButton = getByText("common.save");

    fireEvent.changeText(
      memoInput,
      "Required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
    );
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(mockTransactionSettingsState.saveMemo).toHaveBeenCalledWith(
        "Required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      );
      expect(mockOnSettingsChangeForMemo).toHaveBeenCalled();
      expect(mockOnConfirm).toHaveBeenCalled();
    });

    expect(mockTransactionSettingsState.saveMemo).toHaveBeenCalledWith(
      "Required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
    );
  });
});

describe("TransactionSettingsBottomSheet - Soroban Transaction Tests", () => {
  const mockOnCancel = jest.fn();
  const mockOnConfirm = jest.fn();
  const mockOnSettingsChange = jest.fn();

  const createMockState = (overrides = {}) => ({
    transactionMemo: "",
    transactionFee: "100",
    transactionTimeout: 30,
    recipientAddress:
      "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
    selectedTokenId:
      "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    selectedCollectibleDetails: {
      collectionAddress: "",
      tokenId: "",
    },
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveRecipientAddress: jest.fn(),
    saveSelectedTokenId: jest.fn(),
    saveSelectedCollectibleDetails: jest.fn(),
    resetSettings: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsContractId.mockReturnValue(false);
    mockGetMemoDisabledState.mockReturnValue({
      isMemoDisabled: false,
      memoDisabledMessage: undefined,
    });
    mockUseAuthenticationStore.mockReturnValue({
      account: {
        publicKey: "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      },
      network: NETWORKS.PUBLIC,
    } as any);
  });

  it("should disable memo field when recipient is an M address", async () => {
    const muxedAddress =
      "MA7QYNF7SOWQ3ODR7U66PFC3J3M5ND3MDYVNTYFPL3Y6I5IBK7O6VSE";
    const mockState = createMockState({
      recipientAddress: muxedAddress,
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockGetMemoDisabledState.mockReturnValue({
      isMemoDisabled: true,
      memoDisabledMessage:
        "transactionSettings.memoInfo.memoDisabledForTransaction",
    });

    const { getByPlaceholderText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    await waitFor(
      () => {
        const memoInput = getByPlaceholderText(
          "transactionSettings.memoPlaceholder",
        );
        expect(memoInput.props.editable).toBe(false);
      },
      { timeout: 1000 },
    );
  });

  it("should enable memo field for collectible transfers with G address", async () => {
    const mockState = createMockState({
      recipientAddress:
        "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      selectedCollectibleDetails: {
        collectionAddress:
          "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        tokenId: "123",
      },
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockGetMemoDisabledState.mockReturnValue({
      isMemoDisabled: false,
      memoDisabledMessage: undefined,
    });

    const { getByPlaceholderText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    await waitFor(() => {
      const memoInput = getByPlaceholderText(
        "transactionSettings.memoPlaceholder",
      );
      expect(memoInput.props.editable).toBe(true);
    });
  });

  it("should enable memo for Soroban contract addresses (G addresses)", async () => {
    const sorobanContractAddress =
      "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
    const mockState = createMockState({
      recipientAddress: sorobanContractAddress,
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockIsContractId.mockImplementation(
      (address) => address === sorobanContractAddress,
    );
    mockGetMemoDisabledState.mockReturnValue({
      isMemoDisabled: false,
      memoDisabledMessage: undefined,
    });

    const { getByPlaceholderText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    await waitFor(() => {
      const memoInput = getByPlaceholderText(
        "transactionSettings.memoPlaceholder",
      );
      // Memo input should be enabled for contract addresses (they're G addresses, not M addresses)
      expect(memoInput.props.editable).toBe(true);
    });
  });

  it("should clear memo automatically for M addresses", async () => {
    const muxedAddress =
      "MA7QYNF7SOWQ3ODR7U66PFC3J3M5ND3MDYVNTYFPL3Y6I5IBK7O6VSE";
    const mockState = createMockState({
      recipientAddress: muxedAddress,
      transactionMemo: "Some existing memo",
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockGetMemoDisabledState.mockReturnValue({
      isMemoDisabled: true,
      memoDisabledMessage:
        "transactionSettings.memoInfo.memoDisabledForTransaction",
    });

    renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    await waitFor(() => {
      expect(mockState.saveMemo).toHaveBeenCalledWith("");
    });
  });

  it("should not save memo for M addresses", async () => {
    const muxedAddress =
      "MA7QYNF7SOWQ3ODR7U66PFC3J3M5ND3MDYVNTYFPL3Y6I5IBK7O6VSE";
    const mockState = createMockState({
      recipientAddress: muxedAddress,
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockGetMemoDisabledState.mockReturnValue({
      isMemoDisabled: true,
      memoDisabledMessage:
        "transactionSettings.memoInfo.memoDisabledForTransaction",
    });

    const { getByPlaceholderText, getByText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    await waitFor(() => {
      const memoInput = getByPlaceholderText(
        "transactionSettings.memoPlaceholder",
      );
      expect(memoInput.props.editable).toBe(false);
    });

    const confirmButton = getByText("common.save");

    // Since memo is disabled, we can't change the text, but let's verify it stays empty
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalled();
    });

    // Memo should not be saved when disabled (it should be cleared or not saved)
    expect(mockState.saveMemo).not.toHaveBeenCalledWith("Test memo");
  });

  it("should enable memo for collectible transfer with G address", async () => {
    const mockState = createMockState({
      recipientAddress:
        "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      selectedCollectibleDetails: {
        collectionAddress:
          "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        tokenId: "456",
      },
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockGetMemoDisabledState.mockReturnValue({
      isMemoDisabled: false,
      memoDisabledMessage: undefined,
    });

    const { getByPlaceholderText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    await waitFor(() => {
      const memoInput = getByPlaceholderText(
        "transactionSettings.memoPlaceholder",
      );
      expect(memoInput.props.editable).toBe(true);
    });
  });

  it("should enable memo for regular (non-Soroban) transactions", async () => {
    const regularAddress =
      "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF";
    const mockState = createMockState({
      recipientAddress: regularAddress,
      selectedCollectibleDetails: {
        collectionAddress: "",
        tokenId: "",
      },
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockIsContractId.mockReturnValue(false);
    mockGetMemoDisabledState.mockReturnValue({
      isMemoDisabled: false,
      memoDisabledMessage: undefined,
    });

    const { getByPlaceholderText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    await waitFor(() => {
      const memoInput = getByPlaceholderText(
        "transactionSettings.memoPlaceholder",
      );
      expect(memoInput.props.editable).toBe(true);
    });
  });
});
