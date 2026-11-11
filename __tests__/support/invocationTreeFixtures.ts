/**
 * Authorized-invocation trees of a chosen size, and the auth-entry preimage and
 * transaction that carry one, for tests of the invocation-tree limits. Every
 * node calls the same contract function as sacTransferInvocation(). Test-only.
 */
import {
  Account,
  BASE_FEE,
  hash,
  Networks,
  Operation,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { G_ACCOUNT } from "__tests__/support/muxedContractFixtures";
import {
  sacTransferArgs,
  sacTransferInvocation,
  XLM_SAC_TESTNET,
} from "__tests__/support/sacTransferFixtures";

/** One invocation of the SAC transfer function, with these sub-invocations. */
export const invocationNode = (
  subInvocations: xdr.SorobanAuthorizedInvocation[] = [],
): xdr.SorobanAuthorizedInvocation =>
  new xdr.SorobanAuthorizedInvocation({
    function: sacTransferInvocation().function,
    subInvocations,
  });

/** A root with `total - 1` children: `total` invocations, two levels deep. */
export const wideInvocationTree = (
  total: number,
): xdr.SorobanAuthorizedInvocation =>
  invocationNode(Array.from({ length: total - 1 }, () => invocationNode()));

/** A chain of single children, `depth` invocations deep. */
export const deepInvocationTree = (
  depth: number,
): xdr.SorobanAuthorizedInvocation =>
  depth === 1
    ? invocationNode()
    : invocationNode([deepInvocationTree(depth - 1)]);

/** A testnet envelopeTypeSorobanAuthorization preimage of `invocation`, base64. */
export const authEntryPreimageXdr = (
  invocation: xdr.SorobanAuthorizedInvocation,
): string =>
  xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
    new xdr.HashIdPreimageSorobanAuthorization({
      networkId: new xdr.Hash(hash(Buffer.from(Networks.TESTNET))),
      nonce: BigInt(1),
      signatureExpirationLedger: 1000,
      invocation,
    }),
  ).toXdr("base64");

/** A testnet transaction whose one SAC transfer is authorized by `rootInvocation`, base64. */
export const invokeTransactionXdr = (
  rootInvocation: xdr.SorobanAuthorizedInvocation,
): string =>
  new TransactionBuilder(new Account(G_ACCOUNT, "0"), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: XLM_SAC_TESTNET,
        function: "transfer",
        args: sacTransferArgs(),
        auth: [
          new xdr.SorobanAuthorizationEntry({
            credentials:
              xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
            rootInvocation,
          }),
        ],
      }),
    )
    .setTimeout(0)
    .build()
    .toXDR();
