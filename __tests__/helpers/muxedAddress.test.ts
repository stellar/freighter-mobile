/**
 * Tests for muxed address helper functions
 */
// Mock the backend service
import { NETWORKS, mapNetworkToNetworkDetails } from "config/constants";
import {
  getMemoDisabledState,
  checkContractMuxedSupport,
  determineMuxedDestination,
} from "helpers/muxedAddress";
import { isContractId } from "helpers/soroban";
import {
  isMuxedAccount,
  createMuxedAccount,
  getBaseAccount,
  isValidStellarAddress,
} from "helpers/stellar";
import { checkContractSupportsMuxed } from "services/backend";

jest.mock("services/backend");

// Mock the stellar helpers
jest.mock("helpers/stellar");

jest.mock("helpers/soroban");

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
const mockIsContractId = isContractId as jest.MockedFunction<
  typeof isContractId
>;
const mockCreateMuxedAccount = createMuxedAccount as jest.MockedFunction<
  typeof createMuxedAccount
>;
const mockGetBaseAccount = getBaseAccount as jest.MockedFunction<
  typeof getBaseAccount
>;

const mockT = jest.fn((key: string) => `translated:${key}`);

const networkDetails = mapNetworkToNetworkDetails(NETWORKS.PUBLIC);

describe("muxedAddress helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getMemoDisabledState", () => {
    it("should disable memo for Soroban M addresses (M address with contractId)", async () => {
      mockIsMuxedAccount.mockReturnValue(true);

      const result = await getMemoDisabledState({
        targetAddress: "M...",
        contractId: "contract123",
        networkDetails,
        t: mockT,
      });

      expect(result.isMemoDisabled).toBe(true);
      expect(result.memoDisabledMessage).toBe(
        "translated:transactionSettings.memoInfo.memoDisabledForTransaction",
      );
    });

    it("should allow memo for classic M addresses (M address without contractId)", async () => {
      mockIsMuxedAccount.mockReturnValue(true);

      const result = await getMemoDisabledState({
        targetAddress: "M...",
        t: mockT,
      });

      expect(result.isMemoDisabled).toBe(false);
      expect(result.memoDisabledMessage).toBeUndefined();
    });

    it("should allow memo for classic transactions (no contract)", async () => {
      mockIsMuxedAccount.mockReturnValue(false);

      const result = await getMemoDisabledState({
        targetAddress: "G...",
        t: mockT,
      });

      expect(result.isMemoDisabled).toBe(false);
      expect(result.memoDisabledMessage).toBeUndefined();
    });

    it("should disable memo for contract addresses (C addresses)", async () => {
      mockIsMuxedAccount.mockReturnValue(false);
      mockIsContractId.mockReturnValue(true);

      const result = await getMemoDisabledState({
        targetAddress: "C...",
        contractId: "contract123",
        networkDetails,
        t: mockT,
      });

      expect(result.isMemoDisabled).toBe(true);
      expect(result.memoDisabledMessage).toBe(
        "translated:transactionSettings.memoInfo.memoNotSupportedForOperation",
      );
    });

    it("should allow memo when contract does not support muxed but target is G address", async () => {
      mockIsMuxedAccount.mockReturnValue(false);
      mockIsContractId.mockReturnValue(false);
      mockIsValidStellarAddress.mockReturnValue(true);
      mockCheckContractSupportsMuxed.mockResolvedValue(false);

      const result = await getMemoDisabledState({
        targetAddress: "G...",
        contractId: "contract123",
        networkDetails,
        t: mockT,
      });

      expect(result.isMemoDisabled).toBe(false);
      expect(result.memoDisabledMessage).toBeUndefined();
    });

    it("should disable memo when contract does not support muxed and target is M address", async () => {
      mockIsMuxedAccount.mockReturnValue(true);
      mockIsContractId.mockReturnValue(false);
      mockIsValidStellarAddress.mockReturnValue(false);

      const result = await getMemoDisabledState({
        targetAddress: "M...",
        contractId: "contract123",
        networkDetails,
        t: mockT,
      });

      expect(result.isMemoDisabled).toBe(true);
      expect(result.memoDisabledMessage).toBe(
        "translated:transactionSettings.memoInfo.memoDisabledForTransaction",
      );
    });

    it("should allow memo when contract supports muxed and target is G address", async () => {
      mockIsMuxedAccount.mockReturnValue(false);
      mockIsContractId.mockReturnValue(false);
      mockIsValidStellarAddress.mockReturnValue(true);
      mockCheckContractSupportsMuxed.mockResolvedValue(true);

      const result = await getMemoDisabledState({
        targetAddress: "G...",
        contractId: "contract123",
        networkDetails,
        t: mockT,
      });

      expect(result.isMemoDisabled).toBe(false);
      expect(result.memoDisabledMessage).toBeUndefined();
    });

    it("should disable memo when contract supports muxed but target is M address", async () => {
      mockIsMuxedAccount.mockReturnValue(true);
      mockIsContractId.mockReturnValue(false);
      mockIsValidStellarAddress.mockReturnValue(false);

      const result = await getMemoDisabledState({
        targetAddress: "M...",
        contractId: "contract123",
        networkDetails,
        t: mockT,
      });

      expect(result.isMemoDisabled).toBe(true);
      expect(result.memoDisabledMessage).toBe(
        "translated:transactionSettings.memoInfo.memoDisabledForTransaction",
      );
    });

    it("should allow memo on error checking contract when target is G address", async () => {
      mockIsMuxedAccount.mockReturnValue(false);
      mockIsContractId.mockReturnValue(false);
      mockIsValidStellarAddress.mockReturnValue(true);
      mockCheckContractSupportsMuxed.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await getMemoDisabledState({
        targetAddress: "G...",
        contractId: "contract123",
        networkDetails,
        t: mockT,
      });

      expect(result.isMemoDisabled).toBe(false);
      expect(result.memoDisabledMessage).toBeUndefined();
    });

    it("should disable memo on error checking contract when target is M address", async () => {
      mockIsMuxedAccount.mockReturnValue(true);
      mockIsContractId.mockReturnValue(false);
      mockIsValidStellarAddress.mockReturnValue(false);

      const result = await getMemoDisabledState({
        targetAddress: "M...",
        contractId: "contract123",
        networkDetails,
        t: mockT,
      });

      expect(result.isMemoDisabled).toBe(true);
      expect(result.memoDisabledMessage).toBe(
        "translated:transactionSettings.memoInfo.memoDisabledForTransaction",
      );
    });
  });

  describe("checkContractMuxedSupport", () => {
    it("should call checkContractSupportsMuxed with correct params", async () => {
      mockCheckContractSupportsMuxed.mockResolvedValue(true);

      const result = await checkContractMuxedSupport({
        contractId: "contract123",
        networkDetails,
      });

      expect(mockCheckContractSupportsMuxed).toHaveBeenCalledWith({
        contractId: "contract123",
        networkDetails,
      });
      expect(result).toBe(true);
    });
  });

  describe("determineMuxedDestination", () => {
    const gAddress = "GDQOFC6SKCNBHPLZ7NXQ6MCKFIYUUFVOWYGNWQCXC2F4AYZ27EUWYWH";
    const mAddress =
      "MBSYFNGOTEFXZW5LXRD6DSRZ5OEARI57YKFNQIZGC3ZG6VGRUSNGMAAAAAAAAAAE2L2IK";
    const baseAddress = "GBSYFNGOTEFXZW5LXRD6DSRZ5OEARI57YKFNQIZGC3ZG6VGRUSNGM";

    beforeEach(() => {
      mockIsValidStellarAddress.mockImplementation((addr) =>
        addr.startsWith("G"),
      );
      mockIsContractId.mockReturnValue(false);
    });

    it("should create muxed address when contract supports muxed, G address, and memo provided", () => {
      const newMuxed = "MNEW...";
      mockIsMuxedAccount.mockReturnValue(false);
      mockCreateMuxedAccount.mockReturnValue(newMuxed);

      const result = determineMuxedDestination({
        recipientAddress: gAddress,
        transactionMemo: "1234",
        contractSupportsMuxed: true,
      });

      expect(mockCreateMuxedAccount).toHaveBeenCalledWith(gAddress, "1234");
      expect(result).toBe(newMuxed);
    });

    it("should use G address as-is when contract supports muxed but no memo", () => {
      mockIsMuxedAccount.mockReturnValue(false);

      const result = determineMuxedDestination({
        recipientAddress: gAddress,
        transactionMemo: undefined,
        contractSupportsMuxed: true,
      });

      expect(mockCreateMuxedAccount).not.toHaveBeenCalled();
      expect(result).toBe(gAddress);
    });

    it("should create new muxed when M address provided with new memo and contract supports muxed", () => {
      const newMuxed = "MNEW...";
      // isRecipientGAddress checks: isValidStellarAddress && !isContractId
      // For M address, isValidStellarAddress returns false, so isRecipientGAddress is false
      mockIsValidStellarAddress.mockReturnValue(false);
      mockIsContractId.mockReturnValue(false);
      // isRecipientAlreadyMuxed returns true for M address
      mockIsMuxedAccount.mockReturnValue(true);
      mockGetBaseAccount.mockReturnValue(baseAddress);
      // After getting base, check if it's valid G address (for validation)
      mockIsValidStellarAddress
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      mockIsContractId.mockReturnValueOnce(false).mockReturnValueOnce(false);
      mockCreateMuxedAccount.mockReturnValue(newMuxed);

      const result = determineMuxedDestination({
        recipientAddress: mAddress,
        transactionMemo: "5678",
        contractSupportsMuxed: true,
      });

      expect(mockGetBaseAccount).toHaveBeenCalledWith(mAddress);
      expect(mockCreateMuxedAccount).toHaveBeenCalledWith(baseAddress, "5678");
      expect(result).toBe(newMuxed);
    });

    it("should use M address as-is when contract supports muxed and no memo", () => {
      mockIsMuxedAccount.mockReturnValue(true);

      const result = determineMuxedDestination({
        recipientAddress: mAddress,
        transactionMemo: undefined,
        contractSupportsMuxed: true,
      });

      expect(result).toBe(mAddress);
    });

    it("should extract base G when contract does not support muxed and M address provided", () => {
      mockIsMuxedAccount.mockReturnValue(true);
      mockGetBaseAccount.mockReturnValue(baseAddress);
      mockIsValidStellarAddress.mockReturnValue(true);

      const result = determineMuxedDestination({
        recipientAddress: mAddress,
        transactionMemo: undefined,
        contractSupportsMuxed: false,
      });

      expect(mockGetBaseAccount).toHaveBeenCalledWith(mAddress);
      expect(result).toBe(baseAddress);
    });

    it("should throw error when contract does not support muxed, M address provided, but base is invalid", () => {
      mockIsMuxedAccount.mockReturnValue(true);
      mockGetBaseAccount.mockReturnValue(null);

      expect(() =>
        determineMuxedDestination({
          recipientAddress: mAddress,
          transactionMemo: undefined,
          contractSupportsMuxed: false,
        }),
      ).toThrow("This contract does not support muxed addresses");
    });

    it("should use G address as-is when contract does not support muxed", () => {
      mockIsMuxedAccount.mockReturnValue(false);

      const result = determineMuxedDestination({
        recipientAddress: gAddress,
        transactionMemo: "1234",
        contractSupportsMuxed: false,
      });

      expect(result).toBe(gAddress);
    });
  });
});
