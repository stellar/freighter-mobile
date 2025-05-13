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
      transactionService.prepareSorobanTransaction as jest.Mock
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
        tokenValue: mockTokenValue,
        recipientAddress: mockRecipientAddress,
        publicKey: mockPublicKey,
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
    expect(transactionService.prepareSorobanTransaction).not.toHaveBeenCalled();
  });

  it("should build and prepare a Soroban transaction successfully", async () => {
    await act(async () => {
      await store.getState().buildTransaction({
        tokenValue: mockTokenValue,
        recipientAddress: mockContractAddress,
        publicKey: mockPublicKey,
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
    expect(transactionService.prepareSorobanTransaction).toHaveBeenCalled();
  });

  it("should handle errors during buildTransaction", async () => {
    const buildError = new Error("Build failed");
    (transactionService.buildPaymentTransaction as jest.Mock).mockRejectedValue(
      buildError,
    );

    await act(async () => {
      await store.getState().buildTransaction({
        tokenValue: mockTokenValue,
        recipientAddress: mockRecipientAddress,
        publicKey: mockPublicKey,
        network: mockNetwork,
      });
    });

    const state = store.getState();
    expect(state.isBuilding).toBe(false);
    expect(state.transactionXDR).toBeNull();
    expect(state.error).toBe(buildError.message);
  });

  it("should handle errors during prepareSorobanTransaction", async () => {
    const prepareError = new Error("Prepare failed");
    (
      transactionService.prepareSorobanTransaction as jest.Mock
    ).mockRejectedValue(prepareError);

    await act(async () => {
      await store.getState().buildTransaction({
        tokenValue: mockTokenValue,
        recipientAddress: mockContractAddress,
        publicKey: mockPublicKey,
        network: mockNetwork,
      });
    });

    const state = store.getState();
    expect(state.isBuilding).toBe(false);
    expect(state.transactionXDR).toBeNull();
    expect(state.error).toBe(prepareError.message);
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
});
