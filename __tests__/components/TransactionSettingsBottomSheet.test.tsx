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
    feePriority: "medium",
    saveFeePriority: jest.fn(),
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
      background: { primary: "#ffffff", tertiary: "#f0f0f0" },
      text: { secondary: "#999999" },
      lilac: {
        9: "#6e56cf",
        11: "#9d8bff",
      },
    },
  }),
}));
// Mutable so a test can simulate the fees changing (e.g. a re-fetch on flow
// re-entry) and assert the tier doesn't flicker.
const mockDefaultNetworkFees = {
  recommendedFee: "100",
  networkCongestion: "Low",
  feePresets: {
    low: "0.0001",
    medium: "0.001",
    high: "0.01",
  },
};
let mockNetworkFees = mockDefaultNetworkFees;
jest.mock("hooks/useNetworkFees", () => ({
  useNetworkFees: () => mockNetworkFees,
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
  computeTotalFeeXlm: jest.fn(() => "0"),
}));

// The fee info icon mounts FeeBreakdownBottomSheet (via useFeeDetailsBottomSheet),
// which reads the transaction builder store.
jest.mock("ducks/transactionBuilder", () => ({
  useTransactionBuilderStore: jest.fn(() => ({
    sorobanResourceFeeXlm: null,
    sorobanInclusionFeeXlm: null,
    isBuilding: false,
    error: null,
  })),
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
    feePriority: "medium",
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveFeePriority: jest.fn(),
    saveRecipientAddress: jest.fn(),
    saveSelectedTokenId: jest.fn(),
    saveSelectedCollectibleDetails: jest.fn(),
    resetSettings: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNetworkFees = mockDefaultNetworkFees;
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

  it("sets the fee to the High preset when the High tab is pressed", async () => {
    const { getByText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    fireEvent.press(getByText("transactionSettings.priorityHigh"));
    fireEvent.press(getByText("common.save"));

    await waitFor(() => {
      expect(
        mockTransactionSettingsState.saveTransactionFee,
      ).toHaveBeenCalledWith("0.01");
      // The chosen tier is persisted so it survives refetches and re-entry.
      expect(mockTransactionSettingsState.saveFeePriority).toHaveBeenCalledWith(
        "high",
      );
    });
  });

  it("sets the fee to the Low preset when the Low tab is pressed", async () => {
    const { getByText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    fireEvent.press(getByText("transactionSettings.priorityLow"));
    fireEvent.press(getByText("common.save"));

    await waitFor(() => {
      expect(
        mockTransactionSettingsState.saveTransactionFee,
      ).toHaveBeenCalledWith("0.0001");
      expect(mockTransactionSettingsState.saveFeePriority).toHaveBeenCalledWith(
        "low",
      );
    });
  });

  it("scales the preset fee by operationCount (saves the total across ops)", async () => {
    // Default tier is Med; the Medium preset is 0.001. A 2-op transaction
    // (e.g. swap-to-new-token) stores the total: 0.001 × 2 = 0.002.
    const { getByText } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
        operationCount={2}
      />,
    );

    fireEvent.press(getByText("common.save"));

    await waitFor(() => {
      expect(
        mockTransactionSettingsState.saveTransactionFee,
      ).toHaveBeenCalledWith("0.002");
    });
  });

  it("locks the fee input for presets and unlocks it for Custom", async () => {
    const { getByText, getByTestId } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    // The fee hasn't been manually changed, so the default tier is Med and the
    // input is locked.
    expect(getByTestId("fee-input").props.editable).toBe(false);

    // "Custom" unlocks the input for manual entry.
    fireEvent.press(getByText("transactionSettings.priorityCustom"));
    await waitFor(() => {
      expect(getByTestId("fee-input").props.editable).toBe(true);
    });

    // Selecting a preset locks it again.
    fireEvent.press(getByText("transactionSettings.priorityLow"));
    await waitFor(() => {
      expect(getByTestId("fee-input").props.editable).toBe(false);
    });
  });

  it("opening the fee details does not persist the fee (preview only)", async () => {
    mockIsContractId.mockReturnValue(true);

    const { getByText, getByTestId } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    // Pick the High preset, then open the fee details via the info icon.
    fireEvent.press(getByText("transactionSettings.priorityHigh"));
    fireEvent.press(getByTestId("fee-info-button"));

    // The fee is only persisted on Save, not when opening the details.
    await waitFor(() => {
      expect(
        mockTransactionSettingsState.saveTransactionFee,
      ).not.toHaveBeenCalled();
    });
  });

  it("opens on the stored fee priority tier (preset → input locked)", async () => {
    // The sheet reflects the persisted tier directly — a stored High tier opens
    // locked, regardless of how the fee amount compares to the current presets.
    mockUseTransactionSettingsStore.mockReturnValue({
      ...mockTransactionSettingsState,
      feePriority: "high",
    });

    const { getByTestId } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("fee-input").props.editable).toBe(false);
    });
  });

  it("opens editable when the stored tier is Custom", async () => {
    mockUseTransactionSettingsStore.mockReturnValue({
      ...mockTransactionSettingsState,
      feePriority: "custom",
    });

    const { getByTestId } = renderWithProviders(
      <TransactionSettingsBottomSheet
        onCancel={mockOnCancel}
        onConfirm={mockOnConfirm}
        context={TransactionContext.Send}
        onSettingsChange={mockOnSettingsChange}
      />,
    );

    await waitFor(() => {
      expect(getByTestId("fee-input").props.editable).toBe(true);
    });
  });

  it("follows the stored tier when it updates before the user interacts", async () => {
    // Stored tier starts Custom (editable); then the store updates (e.g. the
    // frozen congestion snapshot lands) and the tab follows + locks the input.
    mockUseTransactionSettingsStore.mockReturnValue({
      ...mockTransactionSettingsState,
      feePriority: "custom",
    });
    const props = {
      onCancel: mockOnCancel,
      onConfirm: mockOnConfirm,
      context: TransactionContext.Send,
      onSettingsChange: mockOnSettingsChange,
    };
    const { getByTestId, rerender } = renderWithProviders(
      <TransactionSettingsBottomSheet {...props} />,
    );
    await waitFor(() => {
      expect(getByTestId("fee-input").props.editable).toBe(true);
    });

    mockUseTransactionSettingsStore.mockReturnValue({
      ...mockTransactionSettingsState,
      feePriority: "high",
    });
    rerender(<TransactionSettingsBottomSheet {...props} />);

    await waitFor(() => {
      expect(getByTestId("fee-input").props.editable).toBe(false);
    });
  });

  it("keeps the selected tier when network presets change (no flicker to Custom)", async () => {
    // Stored tier is Med (locked input).
    const props = {
      onCancel: mockOnCancel,
      onConfirm: mockOnConfirm,
      context: TransactionContext.Send,
      onSettingsChange: mockOnSettingsChange,
    };
    const { getByTestId, rerender } = renderWithProviders(
      <TransactionSettingsBottomSheet {...props} />,
    );

    await waitFor(() => {
      expect(getByTestId("fee-input").props.editable).toBe(false);
    });

    // Fees change underfoot (e.g. a refetch on flow re-entry).
    mockNetworkFees = {
      ...mockDefaultNetworkFees,
      feePresets: { low: "0.0002", medium: "0.0021", high: "0.02" },
    };
    rerender(<TransactionSettingsBottomSheet {...props} />);

    // The tier stays Med (input still locked) — it does NOT flip to Custom.
    await waitFor(() => {
      expect(getByTestId("fee-input").props.editable).toBe(false);
    });
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
    feePriority: "medium",
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveFeePriority: jest.fn(),
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
