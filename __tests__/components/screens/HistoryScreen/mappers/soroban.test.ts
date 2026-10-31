import {
  Account,
  Address,
  Asset as SdkToken,
  Contract,
  nativeToScVal,
  Networks,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import type { Horizon, Transaction, xdr } from "@stellar/stellar-sdk";
import {
  BASE_CONTRACT,
  G_ACCOUNT,
  MUXED_CONTRACT_ID_1234,
} from "__tests__/support/muxedContractFixtures";
import { mapHistoryItemData } from "components/screens/HistoryScreen/mappers";
import { resolveSorobanDisplayIdentity } from "components/screens/HistoryScreen/mappers/soroban";
import { TransactionType } from "components/screens/HistoryScreen/types";
import { NETWORKS, TESTNET_NETWORK_DETAILS } from "config/constants";
import { logger } from "config/logger";
import { getAttrsFromSorobanHorizonOp } from "helpers/soroban";
import { ThemeColors } from "hooks/useColors";
import { getTokenDetails } from "services/backend";

// The network edges of the row mappers.
jest.mock("services/backend", () => ({
  getTokenDetails: jest.fn(),
  fetchCollectibles: jest.fn(),
}));
jest.mock("helpers/getIconUrl");

const mockGetTokenDetails = getTokenDetails as jest.MockedFunction<
  typeof getTokenDetails
>;

const NATIVE_SAC_TESTNET =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const OTHER_CONTRACT =
  "CB64D3G7SM2RTH6JSGG34DDTFTQ5CFDKVDZJZSODMCX4NJ2HV2KN7OHT";
const CIRCLE_ISSUER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";

describe("resolveSorobanDisplayIdentity", () => {
  const passphrase = Networks.TESTNET;

  it("treats symbol 'native' as XLM only for the native contract", () => {
    const nonNativeResult = resolveSorobanDisplayIdentity(
      { symbol: "native", name: "native", contractId: OTHER_CONTRACT },
      passphrase,
    );
    expect(nonNativeResult.isNative).toBe(false);
    expect(nonNativeResult.code).toBe("native");

    const genuine = resolveSorobanDisplayIdentity(
      { symbol: "native", name: "native", contractId: NATIVE_SAC_TESTNET },
      passphrase,
    );
    expect(genuine.isNative).toBe(true);
    expect(genuine.code).toBe("XLM");
  });

  it("accepts a CODE:ISSUER name as a SAC only when the contract id derives from that pair", () => {
    const claimed = `USDC:${CIRCLE_ISSUER}`;
    const unverifiedClaim = resolveSorobanDisplayIdentity(
      { symbol: "USDC", name: claimed, contractId: OTHER_CONTRACT },
      passphrase,
    );
    // Not verified as a SAC: displayed as a plain contract token, issuer NOT
    // taken from the self-reported name.
    expect(unverifiedClaim.isVerifiedSac).toBe(false);
    expect(unverifiedClaim.issuerKey).toBe(OTHER_CONTRACT);

    const realSacId = new SdkToken("USDC", CIRCLE_ISSUER).contractId(
      passphrase,
    );
    const genuine = resolveSorobanDisplayIdentity(
      { symbol: "USDC", name: claimed, contractId: realSacId },
      passphrase,
    );
    expect(genuine.isVerifiedSac).toBe(true);
    expect(genuine.issuerKey).toBe(CIRCLE_ISSUER);
  });
});

const USER = G_ACCOUNT;

/** An `invoke_host_function` record as freighter-backend's `/account-history` serves it. */
const sorobanRecord = (fields: Record<string, unknown>) =>
  ({
    id: "op-1",
    type: "invoke_host_function",
    type_i: 24,
    created_at: "2026-11-03T12:00:00Z",
    transaction_successful: true,
    source_account: USER,
    ...fields,
  }) as unknown as Horizon.ServerApi.OperationRecord;

/**
 * The `envelope_xdr` Horizon serves for a transaction that calls `fnName` on
 * the native SAC. Built with the real SDK, so decoding it is a real decode.
 */
const envelopeXdrCalling = (fnName: string, ...args: xdr.ScVal[]) =>
  new TransactionBuilder(new Account(USER, "0"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(new Contract(NATIVE_SAC_TESTNET).call(fnName, ...args))
    .setTimeout(0)
    .build()
    .toXDR();

describe("getAttrsFromSorobanHorizonOp", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a Mercury record's pre-decoded attributes without logging", () => {
    const op = sorobanRecord({
      transaction_attr: {
        contractId: NATIVE_SAC_TESTNET,
        fnName: "transfer",
        args: { from: USER, to: CIRCLE_ISSUER, amount: 1000n },
      },
    });

    expect(getAttrsFromSorobanHorizonOp(op, TESTNET_NETWORK_DETAILS)).toEqual({
      contractId: NATIVE_SAC_TESTNET,
      fnName: "transfer",
      from: USER,
      to: CIRCLE_ISSUER,
      amount: 1000n,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("decodes the token transfer in a Horizon envelope without logging", () => {
    const op = sorobanRecord({
      transaction_attr: {
        envelope_xdr: envelopeXdrCalling(
          "transfer",
          nativeToScVal(USER, { type: "address" }),
          nativeToScVal(CIRCLE_ISSUER, { type: "address" }),
          nativeToScVal(1000n, { type: "i128" }),
        ),
      },
    });

    expect(
      getAttrsFromSorobanHorizonOp(op, TESTNET_NETWORK_DETAILS),
    ).toMatchObject({
      contractId: NATIVE_SAC_TESTNET,
      fnName: "transfer",
      from: USER,
      to: CIRCLE_ISSUER,
      amount: 1000n,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("decodes the token transfer in a fee-bumped Horizon envelope without logging", () => {
    // A fee bump wraps the transaction that carries the call. SDK 17.4.0's
    // FeeBumpTransaction reads `operations` through to it.
    const inner = TransactionBuilder.fromXDR(
      envelopeXdrCalling(
        "transfer",
        new Address(USER).toScVal(),
        new Address(MUXED_CONTRACT_ID_1234).toScVal(),
        nativeToScVal(1000n, { type: "i128" }),
      ),
      Networks.TESTNET,
    ) as Transaction;
    const op = sorobanRecord({
      transaction_attr: {
        envelope_xdr: TransactionBuilder.buildFeeBumpTransaction(
          G_ACCOUNT,
          "200",
          inner,
          Networks.TESTNET,
        ).toXDR(),
      },
    });

    expect(
      getAttrsFromSorobanHorizonOp(op, TESTNET_NETWORK_DETAILS),
    ).toMatchObject({
      contractId: NATIVE_SAC_TESTNET,
      fnName: "transfer",
      from: USER,
      to: MUXED_CONTRACT_ID_1234,
      amount: 1000n,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns null without logging for a call that isn't a token transfer or mint", () => {
    // The common case, and not a failure: only a record it can't read is
    // logged.
    const op = sorobanRecord({
      transaction_attr: {
        envelope_xdr: envelopeXdrCalling(
          "balance",
          nativeToScVal(USER, { type: "address" }),
        ),
      },
    });

    expect(
      getAttrsFromSorobanHorizonOp(op, TESTNET_NETWORK_DETAILS),
    ).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    ["XDR that doesn't decode", { envelope_xdr: "not-xdr" }],
    ["no envelope", {}],
    ["no transaction_attr", undefined],
    ["null transaction_attr", null],
  ])(
    "returns null instead of throwing for a record with %s",
    (_, transactionAttr) => {
      const op = sorobanRecord({ transaction_attr: transactionAttr });
      expect(
        getAttrsFromSorobanHorizonOp(op, TESTNET_NETWORK_DETAILS),
      ).toBeNull();
      expect(logger.error).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        "getAttrsFromSorobanHorizonOp",
        "Failed to decode Soroban operation",
        expect.anything(),
      );
    },
  );

  it("returns null without logging for a non-Soroban record", () => {
    // Mercury's classic records have no envelope: without the isSorobanOp
    // guard each one would reach the decode and be logged.
    const op = sorobanRecord({
      type: "payment",
      type_i: 1,
      transaction_attr: { operation_count: 1, fee_charged: "100" },
    });

    expect(
      getAttrsFromSorobanHorizonOp(op, TESTNET_NETWORK_DETAILS),
    ).toBeNull();
    expect(logger.error).not.toHaveBeenCalled();
  });
});

const themeColors = {
  foreground: { primary: "#000000" },
} as unknown as ThemeColors;

/**
 * The `envelope_xdr` of a testnet native-SAC `transfer(USER, to, 5 XLM)`,
 * built with the real SDK.
 */
const sacTransferEnvelope = (to: string) =>
  envelopeXdrCalling(
    "transfer",
    new Address(USER).toScVal(),
    new Address(to).toScVal(),
    nativeToScVal(BigInt(50000000), { type: "i128" }),
  );

// Horizon: the base contract in `to`, the mux id beside it, plus the envelope.
const W_BALANCE_CHANGE = {
  asset_type: "native",
  type: "transfer",
  from: USER,
  to: BASE_CONTRACT,
  amount: "5.0000000",
  destination_muxed_id: "1234",
};

const horizonTransfer = () =>
  sorobanRecord({
    asset_balance_changes: [W_BALANCE_CHANGE],
    transaction_attr: {
      envelope_xdr: sacTransferEnvelope(MUXED_CONTRACT_ID_1234),
      fee_charged: "100",
      operation_count: 1,
    },
  });

// Mercury: no balance changes and no envelope; freighter-backend#329 puts the W
// in args.to.
const mercuryTransfer = () =>
  sorobanRecord({
    transaction_attr: {
      fee_charged: "100",
      operation_count: 1,
      contractId: NATIVE_SAC_TESTNET,
      fnName: "transfer",
      args: { from: USER, to: MUXED_CONTRACT_ID_1234, amount: "50000000" },
    },
  });

const mapRow = (operation: Horizon.ServerApi.OperationRecord) =>
  mapHistoryItemData({
    operation,
    accountBalances: {},
    publicKey: USER,
    networkDetails: TESTNET_NETWORK_DETAILS,
    network: NETWORKS.TESTNET,
    themeColors,
  });

describe("history rows for a SAC transfer to a muxed address (W or M)", () => {
  beforeEach(() => {
    mockGetTokenDetails.mockResolvedValue({
      symbol: "native",
      decimals: 7,
      name: "native",
    });
  });

  it.each([
    ["Horizon", horizonTransfer],
    ["Mercury", mercuryTransfer],
  ])(
    "shows the W as the recipient of a direct transfer in a %s record",
    async (_, record) => {
      const row = await mapRow(record());

      expect(row.transactionDetails.transactionType).toBe(
        TransactionType.CONTRACT_TRANSFER,
      );
      expect(row.transactionDetails.contractDetails?.transferDetails?.to).toBe(
        MUXED_CONTRACT_ID_1234,
      );
      expect(row.isAddingFunds).toBe(false);
      expect(row.amountText).toMatch(/^-/);
    },
  );

  it("falls back to a generic row that still shows the W when the envelope can't be decoded", async () => {
    const row = await mapRow(
      sorobanRecord({
        asset_balance_changes: [W_BALANCE_CHANGE],
        transaction_attr: {
          envelope_xdr: "not-xdr",
          fee_charged: "100",
          operation_count: 1,
        },
      }),
    );

    expect(row.transactionDetails.transactionType).toBe(
      TransactionType.CONTRACT,
    );
    expect(row.transactionDetails.assetDiffs?.[0]?.destination).toBe(
      MUXED_CONTRACT_ID_1234,
    );
    expect(row.isAddingFunds).toBe(false);
    expect(row.amountText).toMatch(/^-/);
  });

  it("shows the M on a generic row for a transfer to a muxed account", async () => {
    // Horizon reports an M payee the same way: the base G plus the mux id.
    // CIRCLE_ISSUER with mux id 1234, as encoded by the SDK.
    const circleIssuerMuxed1234 =
      "MA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KAAAAAAAAAAE2KHCO";
    const row = await mapRow(
      sorobanRecord({
        asset_balance_changes: [{ ...W_BALANCE_CHANGE, to: CIRCLE_ISSUER }],
        transaction_attr: {
          envelope_xdr: "not-xdr",
          fee_charged: "100",
          operation_count: 1,
        },
      }),
    );

    expect(row.transactionDetails.transactionType).toBe(
      TransactionType.CONTRACT,
    );
    expect(row.transactionDetails.assetDiffs?.[0]?.destination).toBe(
      circleIssuerMuxed1234,
    );
    expect(row.isAddingFunds).toBe(false);
  });
});
