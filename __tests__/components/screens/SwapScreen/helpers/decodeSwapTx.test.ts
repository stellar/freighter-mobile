import {
  Account,
  Address,
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import lifi from "__tests__/components/screens/SwapScreen/helpers/fixtures/lifiSwapTx.json";
import {
  SwapTxMismatchError,
  decodeSwapTx,
} from "components/screens/SwapScreen/helpers/decodeSwapTx";

const USDC_ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const USDC = `USDC:${USDC_ISSUER}`;
const EURC = "EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2";

const ACCOUNT = Keypair.random().publicKey();
const OTHER = Keypair.random().publicKey();

const classicTx = ({
  ops,
  source = ACCOUNT,
}: {
  ops: ReturnType<typeof Operation.pathPaymentStrictSend>[];
  source?: string;
}) => {
  const builder = new TransactionBuilder(new Account(source, "1"), {
    fee: "100",
    networkPassphrase: Networks.PUBLIC,
  }).setTimeout(180);
  ops.forEach((op) => builder.addOperation(op));
  return builder.build();
};

const pathPayment = (overrides: { destination?: string } = {}) =>
  Operation.pathPaymentStrictSend({
    sendAsset: Asset.native(),
    sendAmount: "100",
    destination: overrides.destination ?? ACCOUNT,
    destAsset: new Asset("USDC", USDC_ISSUER),
    destMin: "17.1941798",
    path: [],
  });

const decode = (
  transactionXdr: string,
  account = ACCOUNT,
  toAsset = USDC,
  fromAsset = "XLM",
) =>
  decodeSwapTx({
    transactionXdr,
    networkPassphrase: Networks.PUBLIC,
    account,
    fromAsset,
    toAsset,
  });

describe("decodeSwapTx", () => {
  describe("classic path payment", () => {
    it("reads the amount sold, minimum received and fee", () => {
      const tx = classicTx({ ops: [pathPayment()] });

      expect(decode(tx.toXDR())).toEqual({
        sendAmount: "100",
        minReceived: "17.1941798",
        fee: "0.00001",
        addsTrustline: false,
      });
    });

    it("reports the changeTrust the backend added", () => {
      const tx = classicTx({
        ops: [
          Operation.changeTrust({ asset: new Asset("USDC", USDC_ISSUER) }),
          pathPayment(),
        ],
      });

      expect(decode(tx.toXDR())).toMatchObject({
        addsTrustline: true,
        fee: "0.00002",
      });
    });

    it("refuses a payment to another account", () => {
      const tx = classicTx({ ops: [pathPayment({ destination: OTHER })] });

      expect(() => decode(tx.toXDR())).toThrow(/path payment/);
    });

    it("refuses a different destination asset", () => {
      const tx = classicTx({ ops: [pathPayment()] });

      expect(() => decode(tx.toXDR(), ACCOUNT, EURC)).toThrow(/path payment/);
    });

    it("refuses a changeTrust for another asset", () => {
      const [code, issuer] = EURC.split(":");
      const tx = classicTx({
        ops: [
          Operation.changeTrust({ asset: new Asset(code, issuer) }),
          pathPayment(),
        ],
      });

      expect(() => decode(tx.toXDR())).toThrow(/trustline/);
    });

    it("refuses another account's transaction", () => {
      const tx = classicTx({ ops: [pathPayment()], source: OTHER });

      expect(() => decode(tx.toXDR())).toThrow(/source account/);
    });

    it("refuses a fee bump", () => {
      const inner = classicTx({ ops: [pathPayment()] });
      const bump = TransactionBuilder.buildFeeBumpTransaction(
        Keypair.random(),
        "200",
        inner,
        Networks.PUBLIC,
      );

      expect(() => decode(bump.toXDR())).toThrow(/fee bump/);
    });
  });

  describe("LI.FI swap call", () => {
    it("reads the amount sold from the authorization tree and the minimum from the call", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdc100k;

      // 100,000 XLM: a 250 XLM LI.FI fee plus 99,750 XLM into the aggregator.
      expect(decode(txXdr, account)).toEqual({
        sendAmount: "100000",
        minReceived: "18191.30443",
        fee: "0.0829393",
        addsTrustline: false,
      });
    });

    it("reports the trustline the swap opens", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdcWithTrust;

      expect(decode(txXdr, account)).toMatchObject({
        sendAmount: "10",
        minReceived: "1.8340983",
        addsTrustline: true,
      });
    });

    it("refuses a swap for another account", () => {
      expect(() => decode(lifi.xlmUsdc100k.xdr, OTHER)).toThrow(
        /source account/,
      );
    });

    it("refuses an authorized transfer of another token", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdc100k;
      const env = xdr.TransactionEnvelope.fromXDR(txXdr, "base64");
      const { body } =
        env.type === "envelopeTypeTx"
          ? env.v1.tx.operations[0]
          : { body: null };
      if (body?.type !== "invokeHostFunction") throw new Error("fixture");
      const [feeTransfer] =
        body.invokeHostFunctionOp.auth[0].rootInvocation.subInvocations;
      if (
        feeTransfer.function.type !== "sorobanAuthorizedFunctionTypeContractFn"
      ) {
        throw new Error("fixture");
      }
      Object.assign(feeTransfer.function.contractFn, {
        contractAddress: new Address(
          new Asset("USDC", USDC_ISSUER).contractId(Networks.PUBLIC),
        ).toScAddress(),
      });

      expect(() => decode(env.toXDR("base64"), account)).toThrow(/transfer/);
    });

    it("refuses a swap into a different asset", () => {
      const { xdr: txXdr, account } = lifi.xlmUsdc100k;

      expect(() => decode(txXdr, account, EURC)).toThrow(/swap call/);
    });
  });

  it.each([
    ["unparseable XDR", "not-a-transaction"],
    ["a swap call with malformed arguments", "malformed"],
  ])("refuses %s as a mismatch", (_, which) => {
    const { xdr: txXdr, account } = lifi.xlmUsdc100k;
    let input = which;
    if (which === "malformed") {
      const env = xdr.TransactionEnvelope.fromXDR(txXdr, "base64");
      const { body } =
        env.type === "envelopeTypeTx"
          ? env.v1.tx.operations[0]
          : { body: null };
      if (body?.type !== "invokeHostFunction") throw new Error("fixture");
      const [feeTransfer] =
        body.invokeHostFunctionOp.auth[0].rootInvocation.subInvocations;
      if (
        feeTransfer.function.type !== "sorobanAuthorizedFunctionTypeContractFn"
      ) {
        throw new Error("fixture");
      }
      // transfer(from, to) with no amount: reading args[2] fails.
      Object.assign(feeTransfer.function.contractFn, {
        args: feeTransfer.function.contractFn.args.slice(0, 2),
      });
      input = env.toXDR("base64");
    }

    expect(() => decode(input, account)).toThrow(SwapTxMismatchError);
  });

  it("refuses a contract token until the picker allows them", () => {
    const tx = classicTx({ ops: [pathPayment()] });

    expect(() =>
      decode(
        tx.toXDR(),
        ACCOUNT,
        "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
      ),
    ).toThrow(/unsupported asset/);
  });
});
