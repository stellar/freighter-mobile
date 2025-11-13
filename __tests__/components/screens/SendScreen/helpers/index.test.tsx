import Blockaid from "@blockaid/client";
import { renderHook } from "@testing-library/react-native";
import {
  useSendBannerContent,
  getTransactionSecurity,
} from "components/screens/SendScreen/helpers";
import { SecurityLevel } from "services/blockaid/constants";
import * as blockaidHelper from "services/blockaid/helper";

// Mock dependencies
jest.mock("services/blockaid/helper");
jest.mock("hooks/useAppTranslation", () => ({
  __esModule: true,
  default: () => ({ t: (key: string) => key }),
}));

const mockAssessTransactionSecurity =
  blockaidHelper.assessTransactionSecurity as jest.MockedFunction<
    typeof blockaidHelper.assessTransactionSecurity
  >;
const mockExtractSecurityWarnings =
  blockaidHelper.extractSecurityWarnings as jest.MockedFunction<
    typeof blockaidHelper.extractSecurityWarnings
  >;

describe("SendScreen Helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getTransactionSecurity", () => {
    it("should return security assessment, warnings, and severity", () => {
      const mockScanResult = {} as Blockaid.StellarTransactionScanResponse;

      mockAssessTransactionSecurity.mockReturnValue({
        level: SecurityLevel.MALICIOUS,
        isMalicious: true,
        isSuspicious: false,
        isUnableToScan: false,
        details: undefined,
      });

      mockExtractSecurityWarnings.mockReturnValue([
        { id: "test-warning", description: "Test warning" },
      ]);

      const result = getTransactionSecurity(mockScanResult);

      expect(result.transactionSecurityAssessment).toEqual({
        level: SecurityLevel.MALICIOUS,
        isMalicious: true,
        isSuspicious: false,
        isUnableToScan: false,
        details: undefined,
      });

      expect(result.transactionSecurityWarnings).toHaveLength(1);
      expect(result.transactionSecuritySeverity).toBe(SecurityLevel.MALICIOUS);
    });

    it("should return empty warnings when transaction is not malicious or suspicious", () => {
      mockAssessTransactionSecurity.mockReturnValue({
        level: SecurityLevel.SAFE,
        isMalicious: false,
        isSuspicious: false,
        isUnableToScan: false,
        details: undefined,
      });

      const result = getTransactionSecurity(undefined);

      expect(result.transactionSecurityWarnings).toEqual([]);
      expect(result.transactionSecuritySeverity).toBeUndefined();
    });

    it("should return suspicious severity when transaction is suspicious but not malicious", () => {
      const mockScanResult = {} as Blockaid.StellarTransactionScanResponse;

      mockAssessTransactionSecurity.mockReturnValue({
        level: SecurityLevel.SUSPICIOUS,
        isMalicious: false,
        isSuspicious: true,
        isUnableToScan: false,
        details: undefined,
      });

      mockExtractSecurityWarnings.mockReturnValue([
        { id: "suspicious-warning", description: "Suspicious activity" },
      ]);

      const result = getTransactionSecurity(mockScanResult);

      expect(result.transactionSecuritySeverity).toBe(SecurityLevel.SUSPICIOUS);
      expect(result.transactionSecurityWarnings).toHaveLength(1);
    });
  });

  describe("useSendBannerContent", () => {
    it("should return undefined when no warnings are present", () => {
      const { result } = renderHook(() =>
        useSendBannerContent({
          isMalicious: false,
          isSuspicious: false,
          isRequiredMemoMissing: false,
          onSecurityWarningPress: jest.fn(),
        }),
      );

      expect(result.current).toBeUndefined();
    });

    it("should return malicious banner content when transaction is malicious", () => {
      const onSecurityWarningPress = jest.fn();

      const { result } = renderHook(() =>
        useSendBannerContent({
          isMalicious: true,
          isSuspicious: false,
          onSecurityWarningPress,
        }),
      );

      expect(result.current).toEqual({
        text: "transactionAmountScreen.errors.malicious",
        variant: "error",
        onPress: onSecurityWarningPress,
      });
    });

    it("should return suspicious banner content when transaction is suspicious", () => {
      const onSecurityWarningPress = jest.fn();

      const { result } = renderHook(() =>
        useSendBannerContent({
          isMalicious: false,
          isSuspicious: true,
          onSecurityWarningPress,
        }),
      );

      expect(result.current).toEqual({
        text: "transactionAmountScreen.errors.suspicious",
        variant: "warning",
        onPress: onSecurityWarningPress,
      });
    });

    it("should prioritize malicious over suspicious when both are true", () => {
      const onSecurityWarningPress = jest.fn();

      const { result } = renderHook(() =>
        useSendBannerContent({
          isMalicious: true,
          isSuspicious: true,
          onSecurityWarningPress,
        }),
      );

      expect(result.current).toEqual({
        text: "transactionAmountScreen.errors.malicious",
        variant: "error",
        onPress: onSecurityWarningPress,
      });
    });

    it("should return memo missing banner content when memo is required and missing", () => {
      const onSecurityWarningPress = jest.fn();
      const onMemoMissingPress = jest.fn();

      const { result } = renderHook(() =>
        useSendBannerContent({
          isMalicious: false,
          isSuspicious: false,
          isRequiredMemoMissing: true,
          onSecurityWarningPress,
          onMemoMissingPress,
        }),
      );

      expect(result.current).toEqual({
        text: "transactionAmountScreen.errors.memoMissing",
        variant: "error",
        onPress: onMemoMissingPress,
      });
    });

    it("should prioritize malicious over memo missing", () => {
      const onSecurityWarningPress = jest.fn();
      const onMemoMissingPress = jest.fn();

      const { result } = renderHook(() =>
        useSendBannerContent({
          isMalicious: true,
          isSuspicious: false,
          isRequiredMemoMissing: true,
          onSecurityWarningPress,
          onMemoMissingPress,
        }),
      );

      expect(result.current).toEqual({
        text: "transactionAmountScreen.errors.malicious",
        variant: "error",
        onPress: onSecurityWarningPress,
      });
    });

    it("should prioritize suspicious over memo missing", () => {
      const onSecurityWarningPress = jest.fn();
      const onMemoMissingPress = jest.fn();

      const { result } = renderHook(() =>
        useSendBannerContent({
          isMalicious: false,
          isSuspicious: true,
          isRequiredMemoMissing: true,
          onSecurityWarningPress,
          onMemoMissingPress,
        }),
      );

      expect(result.current).toEqual({
        text: "transactionAmountScreen.errors.suspicious",
        variant: "warning",
        onPress: onSecurityWarningPress,
      });
    });

    it("should return undefined when memo is missing but no onMemoMissingPress is provided", () => {
      const onSecurityWarningPress = jest.fn();

      const { result } = renderHook(() =>
        useSendBannerContent({
          isMalicious: false,
          isSuspicious: false,
          isRequiredMemoMissing: true,
          onSecurityWarningPress,
        }),
      );

      expect(result.current).toBeUndefined();
    });
  });
});
