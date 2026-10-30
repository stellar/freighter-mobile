/**
 * A Stellar Asset Contract (SAC) `transfer`, in each form the signing screens
 * receive it: its args, its authorized invocation, the auth-entry preimage a
 * dapp sends, and the whole transaction.
 *
 * Test-only, so it lives under `__tests__/support`, and it builds everything
 * with the real `@stellar/stellar-sdk` rather than a mock. `to` defaults to a
 * muxed contract (`W…`) address, the case these fixtures exist to pin.
 */
import {
  Account,
  Address,
  Asset,
  BASE_FEE,
  hash,
  nativeToScVal,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  G_ACCOUNT,
  MUXED_CONTRACT_ID_1234,
} from "__tests__/support/muxedContractFixtures";

/** `Asset.native().contractId(Networks.TESTNET)`: the native asset's SAC on testnet. */
export const XLM_SAC_TESTNET = Asset.native().contractId(Networks.TESTNET);

/** transfer(from: G_ACCOUNT, to, amount: i128 100); `to` defaults to MUXED_CONTRACT_ID_1234. */
export const sacTransferArgs = (
  to: string = MUXED_CONTRACT_ID_1234,
): xdr.ScVal[] => [
  new Address(G_ACCOUNT).toScVal(),
  new Address(to).toScVal(),
  nativeToScVal(BigInt(100), { type: "i128" }),
];

/** contractFn `transfer` on XLM_SAC_TESTNET with sacTransferArgs(to), no sub-invocations. */
export const sacTransferInvocation = (
  to: string = MUXED_CONTRACT_ID_1234,
): xdr.SorobanAuthorizedInvocation =>
  new xdr.SorobanAuthorizedInvocation({
    function:
      xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
        new xdr.InvokeContractArgs({
          contractAddress: new Address(XLM_SAC_TESTNET).toScAddress(),
          functionName: "transfer",
          args: sacTransferArgs(to),
        }),
      ),
    subInvocations: [],
  });

/** envelopeTypeSorobanAuthorization preimage of sacTransferInvocation(to): TESTNET network id, nonce 1, expiry 1000; base64. */
export const sacTransferPreimageXdr = (
  to: string = MUXED_CONTRACT_ID_1234,
): string =>
  xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: new xdr.Hash(hash(Buffer.from(Networks.TESTNET))),
      nonce: BigInt(1),
      signatureExpirationLedger: 1000,
      invocation: sacTransferInvocation(to),
    }),
  ).toXdr("base64");

/** Testnet tx, source G_ACCOUNT built from sequence "0" (the serialized tx carries "1", since build() increments the
 *  account's sequence), BASE_FEE, setTimeout(0): one Operation.invokeContractFunction
 *  (XLM_SAC_TESTNET, "transfer", sacTransferArgs(to)) whose auth is one source-account entry for sacTransferInvocation(to). */
export const sacTransferTransactionXdr = (
  to: string = MUXED_CONTRACT_ID_1234,
): string =>
  new TransactionBuilder(new Account(G_ACCOUNT, "0"), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: XLM_SAC_TESTNET,
        function: "transfer",
        args: sacTransferArgs(to),
        auth: [
          new xdr.SorobanAuthorizationEntry({
            credentials:
              xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
            rootInvocation: sacTransferInvocation(to),
          }),
        ],
      }),
    )
    .setTimeout(0)
    .build()
    .toXdr();
