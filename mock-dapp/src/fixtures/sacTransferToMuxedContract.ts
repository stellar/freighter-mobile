/**
 * Fixture: a native Stellar Asset Contract (SAC) `transfer` to a muxed
 * contract (`W…`) address, for the `stellar_signXDR` route.
 *
 * This is the only file in the mock dApp that imports `@stellar/stellar-sdk`
 * (17.x). Everything else, including `generateAuthPreimageXdr` in `routes.ts`
 * that CI's e2e flows depend on, stays on `@stellar/stellar-base` v14. The
 * signXDR route loads this module on demand, so those routes never load SDK 17.
 * Its CJS build `require()`s ESM-only dependencies, which needs Node 22.12+.
 */
import {
  Account,
  Address,
  Asset,
  nativeToScVal,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

/** The SEP-23 muxed contract vector: `CA7Q…` (contract) with mux id 0. */
export const SEP23_MUXED_CONTRACT =
  "WA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAAAWWC";

/** 1 XLM, in stroops. */
const DEFAULT_AMOUNT_STROOPS = "10000000";

/**
 * Whether `to` can be the transfer's recipient: a string that `Address`
 * accepts and converts to an `ScVal`, as
 * {@link generateSacTransferToMuxedContractXdr} converts it. That is any
 * address with a valid checksum, such as a `G…`, `M…`, `C…` or `W…` one.
 *
 * @param to - The recipient a caller asked for.
 * @returns `true` when the transfer can be built for it.
 */
export function isSacTransferRecipient(to: unknown): to is string {
  if (typeof to !== "string") {
    return false;
  }

  try {
    new Address(to).toScVal();
    return true;
  } catch {
    return false;
  }
}

/**
 * A native SAC `transfer(source → to, amount)`, with a source-account auth
 * entry for the same invocation.
 *
 * Built from `Account(source, "0")`, so the transaction carries sequence `"1"`
 * (`build()` increments the account's), with fee `"1000000"`, `setTimeout(0)`
 * and one `invokeContractFunction` operation on the native asset's SAC for the
 * given network.
 *
 * Throws if `source` or `to` isn't an address `Address` accepts, if
 * `BigInt(amount)` throws (a decimal point or an exponent, say), or if the
 * amount is outside i128's range. `BigInt` is lenient otherwise: it trims
 * whitespace, reads `0x`, `0o` and `0b` prefixes and a minus sign, and takes
 * `""` as 0, so those amounts go through.
 *
 * @param params.network - `"testnet"` or `"pubnet"`; picks the passphrase the
 *   native SAC's contract id is derived for.
 * @param params.source - the `G…` account that sends, and the transaction source.
 * @param params.to - the recipient; defaults to {@link SEP23_MUXED_CONTRACT}.
 * @param params.amount - the amount in stroops; defaults to `"10000000"` (1 XLM).
 * @returns the transaction envelope XDR, base64 (`transaction.toXdr()`).
 */
export function generateSacTransferToMuxedContractXdr(params: {
  network: "testnet" | "pubnet";
  source: string;
  to?: string;
  amount?: string;
}): string {
  const {
    network,
    source,
    to = SEP23_MUXED_CONTRACT,
    amount = DEFAULT_AMOUNT_STROOPS,
  } = params;
  const networkPassphrase =
    network === "pubnet" ? Networks.PUBLIC : Networks.TESTNET;

  const sacContractId = Asset.native().contractId(networkPassphrase);
  const args = [
    new Address(source).toScVal(),
    new Address(to).toScVal(),
    nativeToScVal(BigInt(amount), { type: "i128" }),
  ];

  const invocation = new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(sacContractId).toScAddress(),
          functionName: "transfer",
          args,
        }),
      ),
    subInvocations: [],
  });

  return new TransactionBuilder(new Account(source, "0"), {
    fee: "1000000",
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: sacContractId,
        function: "transfer",
        args,
        auth: [
          new xdr.SorobanAuthorizationEntry({
            credentials:
              xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
            rootInvocation: invocation,
          }),
        ],
      }),
    )
    .setTimeout(0)
    .build()
    .toXdr();
}
