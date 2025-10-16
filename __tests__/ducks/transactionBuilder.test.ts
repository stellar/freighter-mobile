import { act } from "@testing-library/react-hooks";
import { NETWORKS } from "config/constants";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import * as sorobanHelpers from "helpers/soroban";
import * as stellarServices from "services/stellar";
import * as transactionService from "services/transactionService";

jest.mock("config/constants", () => ({
  ...jest.requireActual("config/constants"),
  mapNetworkToNetworkDetails: jest.fn((network) => ({
    network,
    networkPassphrase: `Passphrase for ${network}`,
    networkUrl: `https://horizon-${network}.stellar.org`,
  })),
}));

jest.mock("config/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock("helpers/soroban");
jest.mock("services/stellar");
jest.mock("services/transactionService");

const store = useTransactionBuilderStore;

describe("transactionBuilder Duck", () => {
  const mockPublicKey =
    "GDNF5WJ2BEPABVBXCF4C7KZKM3XYXP27VUE3SCGPZA3VXWWZ7OFA3VPM";
  const mockSecretKey =
    "SA5ZNKYRB4F4ABC65G464G75G6ROLL55GBXXGDE3BV4IT634KMH42M7U";
  const mockRecipientAddress =
    "GAEXPERIMENTALEXAMPLEACCOUNTXXXXXXXXXXXXXXXXXPXV4BSJHU";
  const mockContractAddress =
    "CAEXPERIMENTALEXAMPLEACCOUNTXXXXXXXXXXXXXXXXXPXV4BSJHU";
  const mockTokenValue = "100";
  const mockBuiltXDR = "mockBuiltXDR";
  const mockPreparedXDR = "mockPreparedXDR";
  const mockSignedXDR = "mockSignedXDR";
  const mockTxHash = "mockTxHash";
  const mockNetwork = NETWORKS.TESTNET;

  beforeEach(() => {
    jest.clearAllMocks();
    act(() => {
      store.setState({
        transactionXDR: null,
        signedTransactionXDR: null,
        isBuilding: false,
        isSubmitting: false,
        transactionHash: null,
        error: null,
      });
    });

    (transactionService.buildPaymentTransaction as jest.Mock).mockResolvedValue(
      { xdr: mockBuiltXDR, tx: { sequence: "1" } },
    );
    (
      transactionService.simulateContractTransfer as jest.Mock
    ).mockResolvedValue(mockPreparedXDR);
    (stellarServices.signTransaction as jest.Mock).mockReturnValue(
      mockSignedXDR,
    );
    (stellarServices.submitTx as jest.Mock).mockResolvedValue({
      hash: mockTxHash,
    });
    (sorobanHelpers.isContractId as jest.Mock).mockImplementation((addr) =>
      addr?.startsWith("C"),
    );
  });

  it("should have correct initial state", () => {
    const state = store.getState();
    expect(state.transactionXDR).toBeNull();
    expect(state.signedTransactionXDR).toBeNull();
    expect(state.isBuilding).toBe(false);
    expect(state.isSubmitting).toBe(false);
    expect(state.transactionHash).toBeNull();
    expect(state.error).toBeNull();
  });

  it("should build a standard transaction successfully", async () => {
    await act(async () => {
      await store.getState().buildTransaction({
        tokenAmount: mockTokenValue,
        recipientAddress: mockRecipientAddress,
        senderAddress: mockPublicKey,
        network: mockNetwork,
      });
    });

    const state = store.getState();
    expect(state.isBuilding).toBe(false);
    expect(state.transactionXDR).toBe(mockBuiltXDR);
    expect(state.signedTransactionXDR).toBeNull();
    expect(state.transactionHash).toBeNull();
    expect(state.error).toBeNull();
    expect(transactionService.buildPaymentTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenAmount: mockTokenValue,
        recipientAddress: mockRecipientAddress,
      }),
    );
    expect(transactionService.simulateContractTransfer).not.toHaveBeenCalled();
  });

  it("should build and prepare a Soroban transaction successfully", async () => {
    (
      transactionService.buildPaymentTransaction as jest.Mock
    ).mockResolvedValueOnce({
      xdr: mockBuiltXDR,
      tx: { sequence: "1" },
      contractId: mockContractAddress,
    });

    await act(async () => {
      await store.getState().buildTransaction({
        tokenAmount: mockTokenValue,
        recipientAddress: mockContractAddress,
        senderAddress: mockPublicKey,
        network: mockNetwork,
      });
    });

    const state = store.getState();
    expect(state.isBuilding).toBe(false);
    expect(state.transactionXDR).toBe(mockPreparedXDR);
    expect(state.signedTransactionXDR).toBeNull();
    expect(state.transactionHash).toBeNull();
    expect(state.error).toBeNull();
    expect(transactionService.buildPaymentTransaction).toHaveBeenCalled();
    expect(transactionService.simulateContractTransfer).toHaveBeenCalled();
  });

  it("should handle errors during buildTransaction", async () => {
    const buildError = new Error("Build failed");
    (transactionService.buildPaymentTransaction as jest.Mock).mockRejectedValue(
      buildError,
    );

    await act(async () => {
      await store.getState().buildTransaction({
        tokenAmount: mockTokenValue,
        recipientAddress: mockRecipientAddress,
        senderAddress: mockPublicKey,
        network: mockNetwork,
      });
    });

    const state = store.getState();
    expect(state.isBuilding).toBe(false);
    expect(state.transactionXDR).toBeNull();
    expect(state.error).toBe(buildError.message);
  });

  it("should sign a transaction successfully", () => {
    act(() => {
      store.setState({ transactionXDR: mockBuiltXDR });
    });

    let signedXDR: string | null = null;
    act(() => {
      signedXDR = store.getState().signTransaction({
        secretKey: mockSecretKey,
        network: mockNetwork,
      });
    });

    const state = store.getState();
    expect(signedXDR).toBe(mockSignedXDR);
    expect(state.signedTransactionXDR).toBe(mockSignedXDR);
    expect(state.error).toBeNull();
    expect(stellarServices.signTransaction).toHaveBeenCalledWith({
      tx: mockBuiltXDR,
      secretKey: mockSecretKey,
      network: mockNetwork,
    });
  });

  it("should handle errors during signTransaction (no XDR)", () => {
    let signedXDR: string | null = null;
    act(() => {
      store.setState({ transactionXDR: null });
      signedXDR = store.getState().signTransaction({
        secretKey: mockSecretKey,
        network: mockNetwork,
      });
    });

    const state = store.getState();
    expect(signedXDR).toBeNull();
    expect(state.signedTransactionXDR).toBeNull();
    expect(state.error).toBe("No transaction to sign");
    expect(stellarServices.signTransaction).not.toHaveBeenCalled();
  });

  it("should handle errors thrown by stellarServices.signTransaction", () => {
    const signError = new Error("Sign failed");
    (stellarServices.signTransaction as jest.Mock).mockImplementation(() => {
      throw signError;
    });

    act(() => {
      store.setState({ transactionXDR: mockBuiltXDR });
    });

    let signedXDR: string | null = null;
    act(() => {
      signedXDR = store.getState().signTransaction({
        secretKey: mockSecretKey,
        network: mockNetwork,
      });
    });

    const state = store.getState();
    expect(signedXDR).toBeNull();
    expect(state.signedTransactionXDR).toBeNull();
    expect(state.error).toBe(signError.message);
  });

  it("should submit a transaction successfully", async () => {
    act(() => {
      store.setState({ signedTransactionXDR: mockSignedXDR });
    });

    let hash: string | null = null;
    await act(async () => {
      hash = await store.getState().submitTransaction({ network: mockNetwork });
    });

    const state = store.getState();
    expect(hash).toBe(mockTxHash);
    expect(state.isSubmitting).toBe(false);
    expect(state.transactionHash).toBe(mockTxHash);
    expect(state.error).toBeNull();
    expect(stellarServices.submitTx).toHaveBeenCalledWith({
      tx: mockSignedXDR,
      network: mockNetwork,
    });
  });

  it("should handle errors during submitTransaction (no signed XDR)", async () => {
    let hash: string | null = null;
    await act(async () => {
      store.setState({ signedTransactionXDR: null });
      hash = await store.getState().submitTransaction({ network: mockNetwork });
    });

    const state = store.getState();
    expect(hash).toBeNull();
    expect(state.isSubmitting).toBe(false);
    expect(state.transactionHash).toBeNull();
    expect(state.error).toBe("No signed transaction to submit");
    expect(stellarServices.submitTx).not.toHaveBeenCalled();
  });

  it("should handle errors thrown by stellarServices.submitTx", async () => {
    const submitError = new Error("Submit failed");
    (stellarServices.submitTx as jest.Mock).mockRejectedValue(submitError);

    act(() => {
      store.setState({ signedTransactionXDR: mockSignedXDR });
    });

    let hash: string | null = null;
    await act(async () => {
      hash = await store.getState().submitTransaction({ network: mockNetwork });
    });

    const state = store.getState();
    expect(hash).toBeNull();
    expect(state.isSubmitting).toBe(false);
    expect(state.transactionHash).toBeNull();
    expect(state.error).toBe(submitError.message);
  });

  it("should reset the transaction state", () => {
    act(() => {
      store.setState({
        transactionXDR: mockBuiltXDR,
        signedTransactionXDR: mockSignedXDR,
        isBuilding: false,
        isSubmitting: false,
        transactionHash: mockTxHash,
        error: "Some previous error",
      });
    });

    act(() => {
      store.getState().resetTransaction();
    });

    const state = store.getState();
    expect(state.transactionXDR).toBeNull();
    expect(state.signedTransactionXDR).toBeNull();
    expect(state.isBuilding).toBe(false);
    expect(state.isSubmitting).toBe(false);
    expect(state.transactionHash).toBeNull();
    expect(state.error).toBeNull();
  });

  describe("buildSendCollectibleTransaction", () => {
    const mockCollectionAddress =
      "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
    const mockTokenId = 12345;

    beforeEach(() => {
      (
        transactionService.buildSendCollectibleTransaction as jest.Mock
      ).mockResolvedValue({
        xdr: mockBuiltXDR,
        tx: { toXDR: () => mockBuiltXDR, sequence: "1" },
      });
      (
        transactionService.simulateCollectibleTransfer as jest.Mock
      ).mockResolvedValue(mockPreparedXDR);
    });

    it("should build and simulate a collectible transaction successfully", async () => {
      await act(async () => {
        await store.getState().buildSendCollectibleTransaction({
          collectionAddress: mockCollectionAddress,
          destinationAccount: mockRecipientAddress,
          tokenId: mockTokenId,
          transactionFee: "0.001",
          transactionTimeout: 300,
          network: mockNetwork,
          senderAddress: mockPublicKey,
        });
      });

      const state = store.getState();
      expect(state.isBuilding).toBe(false);
      expect(state.transactionXDR).toBe(mockPreparedXDR);
      expect(state.signedTransactionXDR).toBeNull();
      expect(state.transactionHash).toBeNull();
      expect(state.error).toBeNull();
      expect(
        transactionService.buildSendCollectibleTransaction,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionAddress: mockCollectionAddress,
          recipientAddress: mockRecipientAddress,
          tokenId: mockTokenId,
          transactionFee: "0.001",
          transactionTimeout: 300,
          network: mockNetwork,
          senderAddress: mockPublicKey,
        }),
      );
      expect(transactionService.simulateCollectibleTransfer).toHaveBeenCalled();
    });

    it("should build collectible transaction with memo", async () => {
      const memo = "Sending collectible";

      await act(async () => {
        await store.getState().buildSendCollectibleTransaction({
          collectionAddress: mockCollectionAddress,
          destinationAccount: mockRecipientAddress,
          tokenId: mockTokenId,
          transactionFee: "0.001",
          transactionTimeout: 300,
          transactionMemo: memo,
          network: mockNetwork,
          senderAddress: mockPublicKey,
        });
      });

      expect(
        transactionService.buildSendCollectibleTransaction,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionMemo: memo,
        }),
      );
    });

    it("should handle errors during buildSendCollectibleTransaction", async () => {
      const buildError = new Error("Failed to build collectible transaction");
      (
        transactionService.buildSendCollectibleTransaction as jest.Mock
      ).mockRejectedValue(buildError);

      await act(async () => {
        await store.getState().buildSendCollectibleTransaction({
          collectionAddress: mockCollectionAddress,
          destinationAccount: mockRecipientAddress,
          tokenId: mockTokenId,
          transactionFee: "0.001",
          transactionTimeout: 300,
          network: mockNetwork,
          senderAddress: mockPublicKey,
        });
      });

      const state = store.getState();
      expect(state.isBuilding).toBe(false);
      expect(state.transactionXDR).toBeNull();
      expect(state.error).toBe(buildError.message);
    });

    it("should handle errors during simulateCollectibleTransfer", async () => {
      const simulateError = new Error(
        "Failed to simulate collectible transfer",
      );
      (
        transactionService.simulateCollectibleTransfer as jest.Mock
      ).mockRejectedValue(simulateError);

      await act(async () => {
        await store.getState().buildSendCollectibleTransaction({
          collectionAddress: mockCollectionAddress,
          destinationAccount: mockRecipientAddress,
          tokenId: mockTokenId,
          transactionFee: "0.001",
          transactionTimeout: 300,
          network: mockNetwork,
          senderAddress: mockPublicKey,
        });
      });

      const state = store.getState();
      expect(state.isBuilding).toBe(false);
      expect(state.transactionXDR).toBeNull();
      expect(state.error).toBe(simulateError.message);
    });

    it("should return the prepared XDR from simulation", async () => {
      let result: string | null = null;
      await act(async () => {
        result = await store.getState().buildSendCollectibleTransaction({
          collectionAddress: mockCollectionAddress,
          destinationAccount: mockRecipientAddress,
          tokenId: mockTokenId,
          transactionFee: "0.001",
          transactionTimeout: 300,
          network: mockNetwork,
          senderAddress: mockPublicKey,
        });
      });

      expect(result).toBe(mockPreparedXDR);
      expect(
        transactionService.buildSendCollectibleTransaction,
      ).toHaveBeenCalled();
      expect(transactionService.simulateCollectibleTransfer).toHaveBeenCalled();
    });
  });
});
