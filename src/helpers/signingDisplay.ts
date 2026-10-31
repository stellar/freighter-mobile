/**
 * Dry runs of every conversion that can throw when the signing screens render
 * XDR a dApp sent.
 *
 * The details sheet and the auth-entry sheet decode a request while they draw
 * it, and a conversion that throws there takes down the screen the user is
 * approving from. These checks run the same conversions up front, so the app
 * learns it can't display a request before it offers Confirm, and can offer
 * only Reject instead.
 *
 * Each check calls the same helper, on the same input, as the render site its
 * JSDoc names. That is the whole contract:
 * - A check that converts something the render doesn't would reject a request
 *   the user could have read.
 * - A render conversion that can throw, with no check here, would let a crash
 *   through.
 *
 * The render's other conversions can't throw on XDR that decoded, so they
 * aren't repeated:
 * - `xdrStringToDisplay` and `xdrStringToRaw`, over any bytes.
 * - `xdr.encodeBytes`.
 * - The asset preimage's code and issuer.
 * - The two `toXdr("base64")` re-encodes the render uses as React keys: each
 *   argument's in `KeyValueInvokeHostFnArgs` (`KeyVal.tsx`), and each auth
 *   entry invocation's in `SignTransactionAuthorizations`. Re-encoding a value
 *   that just decoded can only fail by exhausting the stack, which the error
 *   boundaries around the details catch.
 */
import { OperationRecord, xdr } from "@stellar/stellar-sdk";
import { logger } from "config/logger";
import {
  addressToString,
  getCreateContractArgs,
  getInvocationDetails,
  INVOCATION_TYPE_UNRECOGNIZED,
  scValToDisplayTokens,
} from "helpers/soroban";
import {
  normalizeAuthPreimage,
  NormalizedAuthPreimage,
} from "helpers/walletKitValidation";

/**
 * Converts each argument to display tokens, as the signing screens draw it.
 *
 * Mirrors `ScValDisplay`, which `KeyValueInvokeHostFnArgs` renders for every
 * argument of every invocation and creation the screens show. The copy button
 * and the accessibility label use `scValToDisplayValue`, which joins the same
 * tokens, so a value that converts here converts there too.
 *
 * @param args - The `ScVal` arguments to convert.
 * @throws Whatever `scValToDisplayTokens` throws for an argument it can't render.
 */
const assertArgsDisplayable = (args: xdr.ScVal[]): void => {
  args.forEach((arg) => {
    scValToDisplayTokens(arg);
  });
};

/**
 * Checks that the details sheet can render every operation, by running the
 * conversions its render makes for each one. Only the Soroban host functions
 * that invoke or create a contract are checked; any other operation, and a wasm
 * upload, converts nothing here.
 *
 * - Invoking a contract: the contract's address, then each argument.
 *   - The address mirrors `Operations` (`RenderOperationByType` and
 *     `OperationParametersSection`) and `KeyValueInvokeHostFn`. They call
 *     `Address.fromScAddress(...).toString()`, which `addressToString` is for
 *     every address arm, so both throw for the same input.
 *   - The arguments mirror `RenderOperationArgsByType` in `Operations`, which
 *     renders them through `KeyValueInvokeHostFnArgs`.
 * - Creating a contract, read through `getCreateContractArgs` as the render
 *   does (`Operations`, `KeyValueInvokeHostFn`):
 *   - The deployer address of an address preimage, as `KeyValueInvokeHostFn`
 *     shows it (its account arm inlines `addressToString`'s own branch).
 *   - The owner of an external-reference executable, as `ExecutableDetails`
 *     shows it, whatever the preimage is.
 *   - Each constructor argument, as `RenderOperationArgsByType` renders them.
 *
 * @param operations - The operations of a decoded transaction.
 * @throws Whatever the failing conversion throws. A throw means "can't display";
 * the caller decides how to report it.
 */
export const assertOperationsDisplayable = (
  operations: OperationRecord[],
): void => {
  operations.forEach((operation) => {
    if (operation.type !== "invokeHostFunction") {
      return;
    }

    const { func } = operation;

    switch (func.type) {
      case "hostFunctionTypeInvokeContract": {
        const { contractAddress, args } = func.invokeContract;

        addressToString(contractAddress);
        assertArgsDisplayable(args);
        break;
      }

      case "hostFunctionTypeCreateContract":
      case "hostFunctionTypeCreateContractV2": {
        const { contractIdPreimage, executable, constructorArgs } =
          getCreateContractArgs(func);

        if (contractIdPreimage.type === "contractIdPreimageFromAddress") {
          addressToString(contractIdPreimage.fromAddress.address);
        }

        if (executable.type === "contractExecutableExternalRef") {
          addressToString(executable.externalRef.executableOwner);
        }

        // Only a V2 creation has constructor arguments.
        if (constructorArgs) {
          assertArgsDisplayable(constructorArgs);
        }
        break;
      }

      default:
        break;
    }
  });
};

/**
 * Checks that an authorized invocation can be rendered: every argument of every
 * invocation in its tree (the root and each sub-invocation) converts to display
 * tokens.
 *
 * Decodes the tree with `getInvocationDetails`, as the auth-entry screens do
 * (`SignTransactionAuthorizations`, `DappAuthEntryDisplay`). It turns a node it
 * can't decode into an `unrecognized` entry, which those screens render as an
 * explicit warning, so such a node stays displayable here too and has no
 * arguments to convert. The arguments are the ones those screens hand to
 * `KeyValueInvokeHostFnArgs`: a contract call's arguments and a creation's
 * constructor arguments.
 *
 * @param invocation - The root of an authorized invocation tree.
 * @throws Whatever the failing conversion throws. A throw means "can't display";
 * the caller decides how to report it.
 */
export const assertInvocationDisplayable = (
  invocation: xdr.SorobanAuthorizedInvocation,
): void => {
  getInvocationDetails(invocation).forEach((detail) => {
    if (detail.type !== INVOCATION_TYPE_UNRECOGNIZED && detail.args) {
      assertArgsDisplayable(detail.args);
    }
  });
};

/**
 * Whether a `stellar_signAuthEntry` request's preimage can be rendered by
 * `DappAuthEntryDisplay`.
 *
 * Runs what that screen runs for the preimage: it parses the XDR as a
 * `HashIdPreimage` and normalizes both Soroban authorization arms, converts the
 * signer address the CAP-71 arm binds (`signerAddress` there), and renders the
 * invocation, which {@link assertInvocationDisplayable} covers.
 *
 * Reports its own failures, because its caller wants a boolean:
 * - An XDR that doesn't parse, or isn't an authorization preimage, logs a
 *   warning (a breadcrumb: the dApp sent something that isn't an auth entry).
 * - A preimage that decodes but can't be displayed logs an error, which reaches
 *   Sentry: the request is valid and the app can't show it.
 *
 * @param entryXdr - The base64 `HashIdPreimage` the dApp sent.
 * @returns `true` when the screen can render it, `false` when it can't.
 */
export const isAuthEntryDisplayable = (entryXdr: string): boolean => {
  let normalized: NormalizedAuthPreimage | null;

  try {
    normalized = normalizeAuthPreimage(
      xdr.HashIdPreimage.fromXdr(entryXdr, "base64"),
    );
  } catch (e) {
    logger.warn("signingDisplay", "Failed to parse auth entry XDR", e);
    return false;
  }

  if (!normalized) {
    logger.warn(
      "signingDisplay",
      "Auth entry XDR is not a Soroban authorization preimage",
    );
    return false;
  }

  try {
    // Only the CAP-71 arm binds an address; the legacy arm has none to show.
    if (normalized.address) {
      addressToString(normalized.address);
    }

    assertInvocationDisplayable(normalized.invocation);

    return true;
  } catch (e) {
    // `error` rather than `warn`: the XDR parsed, so this is a request the app
    // can't show, with the same rationale as `getInvocationDetails`.
    logger.error(
      "signingDisplay",
      "Failed to build the display data for an auth entry",
      e,
    );
    return false;
  }
};
