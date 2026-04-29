import { render } from "@testing-library/react-native";
import FeeBreakdownBottomSheet from "components/FeeBreakdownBottomSheet";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { useTransactionSettingsStore } from "ducks/transactionSettings";
import React from "react";

jest.mock("ducks/transactionBuilder");
jest.mock("ducks/transactionSettings");

jest.mock("hooks/useAppTranslation", () => () => ({
  t: (key: string) => key,
}));

jest.mock("hooks/useColors", () => () => ({
  themeColors: {
    lilac: { 9: "#8B5CF6", 11: "#6D28D9" },
    foreground: { primary: "#000", secondary: "#666" },
    background: { tertiary: "#F3F4F6" },
    text: { secondary: "#666" },
  },
}));

jest.mock("helpers/soroban", () => ({
  computeTotalFeeXlm: jest.fn(
    (inclusion: string | null, resource: string | null, baseFee: string) => {
      if (inclusion && resource) {
        const sum = parseFloat(inclusion) + parseFloat(resource);
        return sum.toFixed(7).replace(/\.?0+$/, "");
      }
      return baseFee;
    },
  ),
}));

jest.mock("helpers/formatAmount", () => ({
  formatTokenForDisplay: jest.fn(
    (amount: string, token: string) => `${amount} ${token}`,
  ),
}));

const mockUseTransactionBuilderStore =
  useTransactionBuilderStore as jest.MockedFunction<
    typeof useTransactionBuilderStore
  >;
const mockUseTransactionSettingsStore =
  useTransactionSettingsStore as jest.MockedFunction<
    typeof useTransactionSettingsStore
  >;

const BASE_FEE = "0.00001";
const INCLUSION_FEE = "0.00001";
const RESOURCE_FEE = "0.0093238";

const defaultBuilderState = {
  isBuilding: false,
  error: null as string | null,
  sorobanInclusionFeeXlm: null as string | null,
  sorobanResourceFeeXlm: null as string | null,
};

const defaultSettingsState = {
  transactionFee: BASE_FEE,
};

const mockOnClose = jest.fn();

describe("FeeBreakdownBottomSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseTransactionBuilderStore.mockReturnValue(defaultBuilderState as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockUseTransactionSettingsStore.mockReturnValue(
      defaultSettingsState as any,
    );
  });

  describe("Soroban context — pre-simulation (no destination, isBuilding=false)", () => {
    it("shows all 3 rows", () => {
      const { getByText } = render(
        <FeeBreakdownBottomSheet onClose={mockOnClose} isSorobanContext />,
      );
      expect(
        getByText("transactionAmountScreen.details.inclusionFee"),
      ).toBeTruthy();
      expect(
        getByText("transactionAmountScreen.details.resourceFee"),
      ).toBeTruthy();
      expect(
        getByText("transactionAmountScreen.details.totalFee"),
      ).toBeTruthy();
    });

    it("shows base fee as inclusion fee and None for resource fee", () => {
      const { getAllByText, getByText } = render(
        <FeeBreakdownBottomSheet onClose={mockOnClose} isSorobanContext />,
      );
      // Inclusion and total both show base fee (two elements with same text)
      expect(getAllByText(`${BASE_FEE} XLM`).length).toBeGreaterThanOrEqual(2);
      // Resource row shows None when no resource fee data yet
      expect(getByText("transactionAmountScreen.details.none")).toBeTruthy();
    });

    it("shows base fee as total fee when no simulation data", () => {
      const { getAllByText } = render(
        <FeeBreakdownBottomSheet onClose={mockOnClose} isSorobanContext />,
      );
      // Both inclusion and total show the base fee
      const baseFeeTexts = getAllByText(`${BASE_FEE} XLM`);
      expect(baseFeeTexts.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("Soroban context — building (simulation in progress)", () => {
    beforeEach(() => {
      mockUseTransactionBuilderStore.mockReturnValue({
        ...defaultBuilderState,
        isBuilding: true,
        sorobanInclusionFeeXlm: null,
        sorobanResourceFeeXlm: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    });

    it("renders all 3 rows while building and hides fee values", () => {
      const { getByText, queryByText } = render(
        <FeeBreakdownBottomSheet onClose={mockOnClose} isSorobanContext />,
      );
      expect(
        getByText("transactionAmountScreen.details.inclusionFee"),
      ).toBeTruthy();
      expect(
        getByText("transactionAmountScreen.details.resourceFee"),
      ).toBeTruthy();
      expect(
        getByText("transactionAmountScreen.details.totalFee"),
      ).toBeTruthy();
      // Fee values are not rendered while building (replaced by ActivityIndicator)
      expect(queryByText(`${BASE_FEE} XLM`)).toBeNull();
      expect(queryByText("transactionAmountScreen.details.none")).toBeNull();
    });
  });

  describe("Soroban context — simulation complete", () => {
    beforeEach(() => {
      mockUseTransactionBuilderStore.mockReturnValue({
        ...defaultBuilderState,
        isBuilding: false,
        sorobanInclusionFeeXlm: INCLUSION_FEE,
        sorobanResourceFeeXlm: RESOURCE_FEE,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    });

    it("shows all 3 rows with actual fee values", () => {
      const { getByText } = render(
        <FeeBreakdownBottomSheet onClose={mockOnClose} isSorobanContext />,
      );
      expect(getByText(`${INCLUSION_FEE} XLM`)).toBeTruthy();
      expect(getByText(`${RESOURCE_FEE} XLM`)).toBeTruthy();
    });

    it("does not show -- for resource fee when simulation data is available", () => {
      const { queryByText } = render(
        <FeeBreakdownBottomSheet onClose={mockOnClose} isSorobanContext />,
      );
      expect(queryByText("transactionAmountScreen.details.none")).toBeNull();
    });

    it("shows Soroban description text", () => {
      const { getByText } = render(
        <FeeBreakdownBottomSheet onClose={mockOnClose} isSorobanContext />,
      );
      expect(getByText("feeBreakdown.descriptionSoroban")).toBeTruthy();
    });
  });

  describe("Classic context (non-Soroban)", () => {
    it("does not show inclusion or resource fee rows", () => {
      const { queryByText } = render(
        <FeeBreakdownBottomSheet
          onClose={mockOnClose}
          isSorobanContext={false}
        />,
      );
      expect(
        queryByText("transactionAmountScreen.details.inclusionFee"),
      ).toBeNull();
      expect(
        queryByText("transactionAmountScreen.details.resourceFee"),
      ).toBeNull();
    });

    it("shows only total fee row with base fee", () => {
      const { getByText } = render(
        <FeeBreakdownBottomSheet
          onClose={mockOnClose}
          isSorobanContext={false}
        />,
      );
      expect(
        getByText("transactionAmountScreen.details.totalFee"),
      ).toBeTruthy();
      expect(getByText(`${BASE_FEE} XLM`)).toBeTruthy();
    });

    it("shows classic description text", () => {
      const { getByText } = render(
        <FeeBreakdownBottomSheet
          onClose={mockOnClose}
          isSorobanContext={false}
        />,
      );
      expect(getByText("feeBreakdown.descriptionClassic")).toBeTruthy();
    });
  });

  describe("Soroban context — simulation error", () => {
    beforeEach(() => {
      mockUseTransactionBuilderStore.mockReturnValue({
        ...defaultBuilderState,
        isBuilding: false,
        error: "Simulation failed",
        sorobanInclusionFeeXlm: null,
        sorobanResourceFeeXlm: null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    });

    it("shows em-dashes for inclusion and total, None for resource on simulation error", () => {
      const { getAllByText, queryByText } = render(
        <FeeBreakdownBottomSheet onClose={mockOnClose} isSorobanContext />,
      );
      // Inclusion and total rows show em-dash on error
      const emDashes = getAllByText("—");
      expect(emDashes.length).toBeGreaterThanOrEqual(2);
      // Resource row shows None (same as pre-simulation no-data state)
      expect(queryByText("transactionAmountScreen.details.none")).toBeTruthy();
      // No actual fee values shown
      expect(queryByText(`${BASE_FEE} XLM`)).toBeNull();
    });
  });
});
