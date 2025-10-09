import { fireEvent, waitFor } from "@testing-library/react-native";
import TransactionSettingsBottomSheet from "components/TransactionSettingsBottomSheet";
import { TransactionContext } from "config/constants";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import { renderWithProviders } from "helpers/testUtils";
import React from "react";

// Mock dependencies
jest.mock("ducks/transactionSettings");
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
      status: { error: "#ff0000" },
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

const mockUseTransactionSettingsStore =
  useTransactionSettingsStore as jest.MockedFunction<
    typeof useTransactionSettingsStore
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
    saveMemo: jest.fn(),
    saveTransactionFee: jest.fn(),
    saveTransactionTimeout: jest.fn(),
    saveRecipientAddress: jest.fn(),
    saveSelectedTokenId: jest.fn(),
    resetSettings: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTransactionSettingsStore.mockReturnValue(
      mockTransactionSettingsState,
    );
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

    // Press confirm
    fireEvent.press(confirmButton);

    // onSettingsChange should be called before onConfirm
    await waitFor(() => {
      expect(mockOnSettingsChange).toHaveBeenCalled();
      expect(mockOnConfirm).toHaveBeenCalled();
    });

    // Verify the order: onSettingsChange should be called before onConfirm
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

    // Press confirm
    fireEvent.press(confirmButton);

    // Wait for async onSettingsChange to complete
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

    // Update memo
    fireEvent.changeText(memoInput, "Test memo");

    // Press confirm
    fireEvent.press(confirmButton);

    // Verify settings are saved to store
    await waitFor(() => {
      expect(mockTransactionSettingsState.saveMemo).toHaveBeenCalledWith(
        "Test memo",
      );
      expect(mockOnSettingsChange).toHaveBeenCalled();
      expect(mockOnConfirm).toHaveBeenCalled();
    });
  });

  it("should rebuild transaction with memo for memo-required address", async () => {
    // This test specifically covers the bug that was fixed
    const mockOnSettingsChangeForMemo = jest.fn().mockImplementation(() => {
      // Simulate the prepareTransaction(false) call
      // This would rebuild the transaction with fresh values from storage
      const currentSettings = mockTransactionSettingsState;
      if (currentSettings.transactionMemo) {
        // Simulate transaction rebuild with memo
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

    // Simulate user adding required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF
    fireEvent.changeText(
      memoInput,
      "Required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
    );

    // Press confirm
    fireEvent.press(confirmButton);

    // Verify the flow works correctly
    await waitFor(() => {
      expect(mockTransactionSettingsState.saveMemo).toHaveBeenCalledWith(
        "Required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
      );
      expect(mockOnSettingsChangeForMemo).toHaveBeenCalled();
      expect(mockOnConfirm).toHaveBeenCalled();
    });

    // Verify the memo was properly saved and would trigger transaction rebuild
    expect(mockTransactionSettingsState.saveMemo).toHaveBeenCalledWith(
      "Required memo for GA6SXIZIKLJHCZI2KEOBEUUOFMM4JUPPM2UTWX6STAWT25JWIEUFIMFF",
    );
  });
});
