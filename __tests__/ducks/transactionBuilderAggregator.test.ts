import { NETWORKS } from "config/constants";
import { useTransactionBuilderStore } from "ducks/transactionBuilder";
import { getPerOperationBaseFeeStroops } from "helpers/formatAmount";
import { buildChangeTrustTx } from "services/stellar";

jest.mock("services/stellar", () => ({
  ...jest.requireActual("services/stellar"),
  buildChangeTrustTx: jest.fn(),
}));

const mockBuildTrustline = buildChangeTrustTx as jest.Mock;

const transaction = () => ({
  envelopeXdr: "envelope",
  feeStroops: "98024",
  resourceFeeStroops: "97924",
  expiresAt: Math.floor(Date.now() / 1000) + 180,
});
describe("useTransactionBuilderStore — aggregator swap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTransactionBuilderStore.getState().resetTransaction();
  });

  describe("prepareAggregatorSwap", () => {
    it("adopts backend envelope, resets signing state and splits fees", () => {
      const result = useTransactionBuilderStore
        .getState()
        .prepareAggregatorSwap({ transaction: transaction() });
      const state = useTransactionBuilderStore.getState();
      expect(result).toBe("envelope");
      expect(state.transactionXDR).toBe("envelope");
      expect(state.signedTransactionXDR).toBeNull();
      expect(state.sorobanResourceFeeXlm).toBe("0.0097924");
      expect(state.sorobanInclusionFeeXlm).toBe("0.0000100");
      expect(state.transactionExpiresAt).toBe(transaction().expiresAt);
    });
    it.each([
      {},
      { feeStroops: "0" },
      { resourceFeeStroops: "98025" },
      { feeStroops: "20000001" },
      { expiresAt: 1 },
      { resourceFeeStroops: "-1" },
    ])("rejects missing, expired or invalid metadata %p", (bad) => {
      const valid = transaction();
      const candidate = Object.keys(bad).length
        ? { ...valid, ...bad }
        : { envelopeXdr: valid.envelopeXdr };
      useTransactionBuilderStore.setState({
        signedTransactionXDR: "previous",
        transactionHash: "old",
      });
      expect(
        useTransactionBuilderStore
          .getState()
          .prepareAggregatorSwap({ transaction: candidate }),
      ).toBeNull();
      const state = useTransactionBuilderStore.getState();
      expect(state.transactionXDR).toBeNull();
      expect(state.signedTransactionXDR).toBeNull();
      expect(state.transactionHash).toBeNull();
    });
  });
  describe("buildTrustlineTransaction", () => {
    const params = {
      tokenCode: "USDC",
      issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      transactionFee: "0.00001",
      transactionTimeout: 180,
      network: NETWORKS.PUBLIC,
      senderAddress: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
    };

    it("stores the trustline transaction as the one to sign", async () => {
      mockBuildTrustline.mockResolvedValue("trustline-xdr");

      const xdr = await useTransactionBuilderStore
        .getState()
        .buildTrustlineTransaction(params);

      const state = useTransactionBuilderStore.getState();
      expect(mockBuildTrustline).toHaveBeenCalledWith({
        network: params.network,
        publicKey: params.senderAddress,
        tokenIdentifier: `USDC:${params.issuer}`,
        fee: getPerOperationBaseFeeStroops(params.transactionFee, 1),
        timeoutSeconds: params.transactionTimeout,
      });
      expect(xdr).toBe("trustline-xdr");
      expect(state.transactionXDR).toBe("trustline-xdr");
      expect(state.isSoroban).toBe(false);
      expect(state.isBuilding).toBe(false);
    });

    it("reports a failed build and stores nothing to sign", async () => {
      mockBuildTrustline.mockRejectedValue(new Error("account not found"));

      const xdr = await useTransactionBuilderStore
        .getState()
        .buildTrustlineTransaction(params);

      const state = useTransactionBuilderStore.getState();
      expect(xdr).toBeNull();
      expect(state.transactionXDR).toBeNull();
      expect(state.error).toBe(
        "Failed to build trustline transaction: account not found",
      );
    });
  });
});
