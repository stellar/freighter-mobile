import { fireEvent, waitFor } from "@testing-library/react-native";
import BigNumber from "bignumber.js";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import { TransactionContext, NETWORKS } from "config/constants";
import { PricedBalance, TokenTypeWithCustomToken } from "config/types";
import { useAuthenticationStore } from "ducks/auth";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { isContractId, isSorobanTransaction } from "helpers/soroban";
import { isMuxedAccount, isValidStellarAddress } from "helpers/stellar";
import { renderWithProviders } from "helpers/testUtils";
import { useBalancesList } from "hooks/useBalancesList";
import React from "react";
import { checkContractSupportsMuxed } from "services/backend";

jest.mock("ducks/transactionSettings");
jest.mock("ducks/auth", () => ({
  useAuthenticationStore: jest.fn(),
}));

jest.mock("hooks/useBalancesList", () => ({
  useBalancesList: jest.fn(),
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

jest.mock("services/backend", () => ({
  checkContractSupportsMuxed: jest.fn(),
}));

jest.mock("helpers/stellar", () => ({
  isMuxedAccount: jest.fn(),
  isValidStellarAddress: jest.fn(),
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
const mockCheckContractSupportsMuxed =
  checkContractSupportsMuxed as jest.MockedFunction<
    typeof checkContractSupportsMuxed
  >;
const mockIsMuxedAccount = isMuxedAccount as jest.MockedFunction<
  typeof isMuxedAccount
>;
const mockIsValidStellarAddress = isValidStellarAddress as jest.MockedFunction<
  typeof isValidStellarAddress
>;
const mockUseBalancesListTyped = useBalancesList as jest.MockedFunction<
  typeof useBalancesList
>;
const mockIsSorobanTransaction = isSorobanTransaction as jest.MockedFunction<
  typeof isSorobanTransaction
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
    });
    mockUseBalancesListTyped.mockReturnValue({
      balanceItems: [],
      scanResults: {},
      isLoading: false,
      error: null,
      noBalances: true,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    });
    mockIsContractId.mockReturnValue(false);
    mockIsMuxedAccount.mockReturnValue(false);
    mockIsValidStellarAddress.mockReturnValue(true);
    // For regular transactions (no contractId), memo is enabled
    // checkContractSupportsMuxed won't be called since contractId is undefined
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
    const asyncOnSettingsChange = jest.fn().mockResolvedValue(undefined);

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
    mockIsMuxedAccount.mockReturnValue(false);
    mockIsValidStellarAddress.mockReturnValue(true);
    // Don't set a default - let each test set its own value
    mockUseBalancesListTyped.mockReturnValue({
      balanceItems: [],
      scanResults: {},
      isLoading: false,
      error: null,
      noBalances: true,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    });
    mockUseAuthenticationStore.mockReturnValue({
      account: {
        publicKey: "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      },
      network: NETWORKS.PUBLIC,
    });
  });

  it("should disable memo field when recipient is an M address", async () => {
    const muxedAddress =
      "MA7QYNF7SOWQ3ODR7U66PFC3J3M5ND3MDYVNTYFPL3Y6I5IBK7O6VSE";
    const mockState = createMockState({
      recipientAddress: muxedAddress,
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    // M address should disable memo regardless of contract support
    mockIsMuxedAccount.mockReturnValue(true);

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

  it("should enable memo field for collectible transfers with G address when contract supports to_muxed", async () => {
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
    mockIsMuxedAccount.mockReturnValue(false);
    mockIsValidStellarAddress.mockReturnValue(true);
    // Contract supports muxed (to_muxed) → memo should be enabled
    mockCheckContractSupportsMuxed.mockResolvedValue(true);

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

  it("should enable memo for Soroban contract addresses (G addresses) when contract supports to_muxed", async () => {
    const sorobanContractAddress =
      "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
    const gAddress = "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF";
    const mockState = createMockState({
      recipientAddress: gAddress,
      selectedTokenId: `CUSTOM:${sorobanContractAddress}`,
    });

    // Mock a custom token balance so isSorobanTransaction is true and contractId is set
    const mockSorobanBalance: PricedBalance & {
      id: string;
      tokenType: TokenTypeWithCustomToken;
    } = {
      id: `CUSTOM:${sorobanContractAddress}`,
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      token: {
        code: "CUSTOM",
        issuer: { key: sorobanContractAddress },
        type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      },
      contractId: sorobanContractAddress,
      name: "Custom Token",
      symbol: "CUSTOM",
      decimals: 7,
      total: new BigNumber("1000"),
      available: new BigNumber("1000"),
    };
    mockUseBalancesListTyped.mockReturnValue({
      balanceItems: [mockSorobanBalance],
      scanResults: {},
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockIsContractId.mockImplementation(
      (address) => address === sorobanContractAddress,
    );
    // Mock isSorobanTransaction to return true when we have a custom token balance
    mockIsSorobanTransaction.mockReturnValue(true);
    mockIsMuxedAccount.mockReturnValue(false);
    mockIsValidStellarAddress.mockReturnValue(true);
    // Contract supports muxed (to_muxed) → memo should be enabled
    mockCheckContractSupportsMuxed.mockReset();
    mockCheckContractSupportsMuxed.mockResolvedValue(true);

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
      // Memo input should be enabled when contract supports muxed
      expect(memoInput.props.editable).toBe(true);
    });
  });

  it("should disable memo for Soroban contract addresses (G addresses) when contract does not support to_muxed", async () => {
    const sorobanContractAddress =
      "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
    const gAddress = "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF";
    const mockState = createMockState({
      recipientAddress: gAddress,
      selectedTokenId: `CUSTOM:${sorobanContractAddress}`,
    });

    // Contract doesn't support muxed (no to_muxed in contract spec) → memo should be disabled
    // Reset and set to false BEFORE setting up other mocks to ensure it's ready when component renders
    mockCheckContractSupportsMuxed.mockReset();
    mockCheckContractSupportsMuxed.mockResolvedValue(false);

    // Mock a custom token balance so isSorobanTransaction is true and contractId is set
    const mockSorobanBalance: PricedBalance & {
      id: string;
      tokenType: TokenTypeWithCustomToken;
    } = {
      id: `CUSTOM:${sorobanContractAddress}`,
      tokenType: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      token: {
        code: "CUSTOM",
        issuer: { key: sorobanContractAddress },
        type: TokenTypeWithCustomToken.CUSTOM_TOKEN,
      },
      contractId: sorobanContractAddress,
      name: "Custom Token",
      symbol: "CUSTOM",
      decimals: 7,
      total: new BigNumber("1000"),
      available: new BigNumber("1000"),
    };
    mockUseBalancesListTyped.mockReturnValue({
      balanceItems: [mockSorobanBalance],
      scanResults: {},
      isLoading: false,
      error: null,
      noBalances: false,
      isRefreshing: false,
      isFunded: true,
      handleRefresh: jest.fn(),
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockIsContractId.mockImplementation(
      (address) => address === sorobanContractAddress,
    );
    // Mock isSorobanTransaction to return true when we have a custom token balance
    mockIsSorobanTransaction.mockReturnValue(true);
    mockIsMuxedAccount.mockReturnValue(false);
    mockIsValidStellarAddress.mockReturnValue(true);

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
      // Memo input should be disabled when contract doesn't support muxed
      expect(memoInput.props.editable).toBe(false);
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
    // M address should disable memo regardless of contract support
    mockIsMuxedAccount.mockReturnValue(true);

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
    // M address should disable memo regardless of contract support
    mockIsMuxedAccount.mockReturnValue(true);

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

  it("should enable memo for collectible transfer with G address when contract supports to_muxed", async () => {
    const contractAddress =
      "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
    const mockState = createMockState({
      recipientAddress:
        "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      selectedCollectibleDetails: {
        collectionAddress: contractAddress,
        tokenId: "456",
      },
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockIsMuxedAccount.mockReturnValue(false);
    mockIsValidStellarAddress.mockReturnValue(true);
    // Contract supports muxed (to_muxed) → memo should be enabled
    mockCheckContractSupportsMuxed.mockResolvedValue(true);

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

  it("should disable memo for collectible transfer with G address when contract does not support to_muxed", async () => {
    const contractWithoutMuxed =
      "CBHUX3RSBKAL7MJUOUA3PPW3TA65YRFLCGASJ5TNHY7HDLXCHWZQA6GR";
    const mockState = createMockState({
      recipientAddress:
        "GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      selectedCollectibleDetails: {
        collectionAddress: contractWithoutMuxed,
        tokenId: "456",
      },
    });

    mockUseTransactionSettingsStore.mockReturnValue(mockState);
    mockIsMuxedAccount.mockReturnValue(false);
    mockIsValidStellarAddress.mockReturnValue(true);
    // Contract doesn't support muxed (to_muxed) → memo should be disabled
    mockCheckContractSupportsMuxed.mockReset();
    mockCheckContractSupportsMuxed.mockResolvedValue(false);

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
      expect(memoInput.props.editable).toBe(false);
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
    mockIsMuxedAccount.mockReturnValue(false);
    mockIsValidStellarAddress.mockReturnValue(true);
    // No contract ID means regular transaction, memo should be enabled
    // (getMemoDisabledState returns early when no contractId, so checkContractSupportsMuxed won't be called)

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
