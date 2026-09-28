/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  StrKey,
  TransactionBuilder,
  Operation,
  OperationRecord,
  Transaction,
  Horizon,
  xdr,
  scValToNative,
  Asset as SdkToken,
  walkInvocationTree,
  Address,
} from "@stellar/stellar-sdk";
import { BigNumber } from "bignumber.js";
import {
  mapNetworkToNetworkDetails,
  NATIVE_TOKEN_CODE,
  NetworkDetails,
  NETWORKS,
} from "config/constants";
import { logger } from "config/logger";
import { Balance } from "config/types";
import {
  getNativeContractId,
  isNativeContract,
  isNativeToken,
} from "helpers/assetIdentity";

export const SOROBAN_OPERATION_TYPES = [
  "invoke_host_function",
  "invokeHostFunction",
];

export enum SorobanTokenInterface {
  transfer = "transfer",
  mint = "mint",
}

export type ArgsForTokenInvocation = {
  from: string;
  to: string;
  amount?: bigint | number;
  tokenId?: number;
};

export type TokenInvocationArgs = ArgsForTokenInvocation & {
  fnName: SorobanTokenInterface;
  contractId: string;
};

export interface SorobanToken {
  // only currently holds fields we care about
  transfer: (from: string, to: string, amount: number) => void;
  mint: (to: string, amount: number) => void;
  // values below are in storage
  name: string;
  balance: number;
  symbol: string;
  decimals: number;
}

export const isContractId = (contractId: string) => {
  try {
    StrKey.decodeContract(contractId);
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Checks if a transaction is a Soroban transaction.
 * A transaction is considered Soroban if:
 * - The selected balance is a Soroban token (has a contractId), OR
 * - The recipient address is a contract address
 *
 * @param selectedBalance - The selected balance (can be undefined)
 * @param recipientAddress - The recipient address (can be undefined)
 * @returns True if the transaction is a Soroban transaction, false otherwise
 */
export const isSorobanTransaction = (
  selectedBalance?: Balance,
  recipientAddress?: string,
): boolean =>
  Boolean(
    (selectedBalance &&
      "contractId" in selectedBalance &&
      Boolean(selectedBalance.contractId)) ||
      (recipientAddress && isContractId(recipientAddress)),
  );

/**
 * Returns the total fee in XLM for display.
 * For Soroban: inclusion + resource. For classic: the flat transactionFee.
 */
export const computeTotalFeeXlm = (
  sorobanInclusionFeeXlm: string | null,
  sorobanResourceFeeXlm: string | null,
  transactionFee: string,
): string =>
  sorobanInclusionFeeXlm && sorobanResourceFeeXlm
    ? new BigNumber(sorobanInclusionFeeXlm)
        .plus(sorobanResourceFeeXlm)
        .toString()
    : transactionFee;

export const getNativeContractDetails = (network: NETWORKS) => {
  const NATIVE_CONTRACT_DEFAULTS = {
    code: NATIVE_TOKEN_CODE,
    decimals: 7,
    domain: "https://stellar.org",
    icon: "",
    org: "",
  };

  // The native SAC address derives deterministically from the network
  // passphrase, which keeps every network correct.
  const contract = getNativeContractId(
    mapNetworkToNetworkDetails(network).networkPassphrase,
  );

  switch (network) {
    case NETWORKS.PUBLIC:
      return {
        ...NATIVE_CONTRACT_DEFAULTS,
        contract,
        issuer: "GDMTVHLWJTHSUDMZVVMXXH6VJHA2ZV3HNG5LYNAZ6RTWB7GISM6PGTUV",
      };
    default:
      return { ...NATIVE_CONTRACT_DEFAULTS, contract, issuer: "" };
  }
};

export const addressToString = (address: xdr.ScAddress) => {
  if (address.type === "scAddressTypeAccount") {
    return StrKey.encodeEd25519PublicKey(address.accountId.ed25519.toBytes());
  }
  return Address.fromScAddress(address).toString();
};

/**
 * Narrows an ScVal to its SCV_ADDRESS arm.
 *
 * Pre-v17 the generated arm accessor (`scVal.address()`) threw when the union
 * carried a different arm; `expectUnionVariant` preserves that contract now
 * that arms are plain properties on variant classes.
 *
 * @throws TypeError if the value is not an SCV_ADDRESS
 */
export const scValToAddress = (scVal: xdr.ScVal): xdr.ScAddress =>
  xdr.expectUnionVariant(scVal, "scvAddress").address;

/**
 * Extracts the address credentials from a SorobanCredentials union, handling
 * all CAP-71 address arms. Returns null for source-account credentials, which
 * carry no address payload.
 */
export const getAddressCredentials = (
  credentials: xdr.SorobanCredentials,
): xdr.SorobanAddressCredentials | null => {
  switch (credentials.type) {
    case "sorobanCredentialsAddress":
      return credentials.address;
    case "sorobanCredentialsAddressV2":
      return credentials.addressV2;
    case "sorobanCredentialsAddressWithDelegates":
      return credentials.addressWithDelegates.addressCredentials;
    default:
      return null;
  }
};

/**
 * Returns the address a Soroban authorization entry is bound to (the address
 * whose authorization its credentials represent), or undefined for
 * source-account credentials.
 */
export const getAuthEntryBoundAddress = (
  entry: xdr.SorobanAuthorizationEntry,
): string | undefined => {
  const addressCredentials = getAddressCredentials(entry.credentials);
  return addressCredentials
    ? addressToString(addressCredentials.address)
    : undefined;
};

const DISPLAY_INDENT = "  ";

/** Soroban symbols are `[a-zA-Z0-9_]`, so anything else has to be quoted. */
const isBareSymbol = (value: string) => /^[a-zA-Z0-9_]+$/.test(value);

/** An `XdrString`-backed field, reached through its canonical wire bytes. */
type XdrStringLike = { bytes: Uint8Array };

/** What an `XdrString`-backed field is, where that decides its quoting. */
type XdrStringKind = "string" | "symbol";

/** The escapes SEP-0051 gives a name to, so the common ones stay readable. */
const NAMED_ESCAPES = new Map([
  [0x00, "\\0"],
  [0x09, "\\t"],
  [0x0a, "\\n"],
  [0x0d, "\\r"],
  [0x5c, "\\\\"],
]);

const hexEscape = (byte: number) => `\\x${byte.toString(16).padStart(2, "0")}`;

/**
 * Decodes the UTF-8 sequence starting at `index`, or `null` when the bytes
 * there are not valid UTF-8.
 *
 * Written out rather than delegating to `new TextDecoder("utf-8", { fatal:
 * true })`: React Native's `TextDecoder` polyfill does not implement the
 * `fatal` option and *throws from the constructor* when given it, so a strict
 * decoder built that way works under Jest (Node implements it) and breaks on
 * device. The arithmetic below avoids bitwise operators for the same reason
 * the rest of this file does -- the lint rules forbid them -- and is exact for
 * these ranges.
 */
const decodeUtf8At = (
  bytes: Uint8Array,
  index: number,
): { code: number; width: number } | null => {
  const first = bytes[index];

  if (first < 0x80) {
    return { code: first, width: 1 };
  }

  let width: number;
  let code: number;

  if (first >= 0xc2 && first <= 0xdf) {
    width = 2;
    code = first % 0x20;
  } else if (first >= 0xe0 && first <= 0xef) {
    width = 3;
    code = first % 0x10;
  } else if (first >= 0xf0 && first <= 0xf4) {
    width = 4;
    code = first % 0x08;
  } else {
    return null;
  }

  if (index + width > bytes.length) {
    return null;
  }

  for (let offset = 1; offset < width; offset += 1) {
    const continuation = bytes[index + offset];
    if (continuation < 0x80 || continuation > 0xbf) {
      return null;
    }
    code = code * 64 + (continuation % 64);
  }

  // Overlong encodings, surrogate halves and out-of-range codepoints are all
  // things a strict decoder rejects, and each one would otherwise give a
  // second spelling of a byte string that already has one.
  if (width === 3 && code < 0x800) {
    return null;
  }
  if (width === 4 && code < 0x10000) {
    return null;
  }
  if (code >= 0xd800 && code <= 0xdfff) {
    return null;
  }
  if (code > 0x10ffff) {
    return null;
  }

  return { code, width };
};

/** Strict UTF-8 decode of a whole byte string; `undefined` when it is not text. */
const strictUtf8Decode = (bytes: Uint8Array): string | undefined => {
  let out = "";
  let index = 0;

  while (index < bytes.length) {
    const decoded = decodeUtf8At(bytes, index);
    if (!decoded) {
      return undefined;
    }
    out += String.fromCodePoint(decoded.code);
    index += decoded.width;
  }

  return out;
};

/**
 * Codepoints that decode cleanly but cannot be seen: C1 controls, bidi
 * overrides and zero-width marks. Left as-is they let one signed string
 * impersonate another on the approval screen — the same defect as a lenient
 * byte decode, just spelled in valid UTF-8.
 */
const isInvisible = (code: number) =>
  (code >= 0x7f && code <= 0x9f) ||
  (code >= 0x200b && code <= 0x200f) ||
  (code >= 0x202a && code <= 0x202e) ||
  (code >= 0x2066 && code <= 0x2069) ||
  code === 0xfeff;

/**
 * Renders the wire bytes of an `XdrString` as display text that stands for
 * exactly one byte string.
 *
 * These fields are byte strings, not guaranteed text, and every lossy reading
 * of them collapses distinct signed payloads onto one screen string: the
 * lenient `toString()` turns every invalid byte into U+FFFD, so `"transfer" +
 * 0xFF` and `"transfer" + 0xFE` look the same; a bare hex fallback can be
 * spelled out by valid text that happens to read `string(0x...)`; and an
 * unescaped bidi override can reorder what is drawn without changing what is
 * signed.
 *
 * So: escape rather than substitute. Backslash, the C0/C1 controls and the
 * invisible codepoints become escapes, invalid bytes become `\xNN`, and
 * everything else — including ordinary non-ASCII text — is passed through
 * untouched. Because the backslash is itself escaped, the escapes are
 * prefix-free and no two byte strings can produce the same output.
 *
 * This is the SDK's SEP-0051 `toJson()` alphabet, widened to leave legible
 * text legible: `toJson()` hex-escapes every byte above ASCII, which would
 * render `café` as `caf\xc3\xa9` on every signing screen.
 */
export const escapeXdrString = (bytes: Uint8Array): string => {
  let out = "";
  let index = 0;

  while (index < bytes.length) {
    const byte = bytes[index];
    const named = NAMED_ESCAPES.get(byte);

    if (named) {
      out += named;
      index += 1;
    } else if (byte < 0x20) {
      out += hexEscape(byte);
      index += 1;
    } else if (byte < 0x7f) {
      out += String.fromCharCode(byte);
      index += 1;
    } else {
      // Above ASCII: decode the one sequence starting here, strictly, so a
      // byte that cannot be part of valid text is escaped on its own rather
      // than swallowing the bytes that follow it.
      const decoded = decodeUtf8At(bytes, index);

      if (!decoded) {
        out += hexEscape(byte);
        index += 1;
      } else {
        out += isInvisible(decoded.code)
          ? `\\u{${decoded.code.toString(16)}}`
          : String.fromCodePoint(decoded.code);
        index += decoded.width;
      }
    }
  }

  return out;
};

/**
 * Decodes an `XdrString`-backed field (an SCString, an SCSymbol, a function
 * name, a CAP-85 executable tag) for display. See {@link escapeXdrString} for
 * why the bytes are escaped rather than decoded leniently.
 */
export const xdrStringToDisplay = (value: XdrStringLike): string =>
  escapeXdrString(value.bytes);

/**
 * The raw text of an `XdrString`-backed field, for the few places that need a
 * lookup key rather than something to show — the contract-spec lookup, most
 * obviously. `undefined` when the bytes are not text, because there is then no
 * name to look up and the escaped display form is not one.
 */
export const xdrStringToRaw = (value: XdrStringLike): string | undefined =>
  strictUtf8Decode(value.bytes);

/** As {@link xdrStringToDisplay}, but quoted for use inside a value literal. */
const xdrStringToLiteral = (value: XdrStringLike, kind: XdrStringKind) => {
  const escaped = escapeXdrString(value.bytes);
  // Layer 1 has already escaped every backslash, so an escaped quote here can
  // only have come from a quote in the signed bytes.
  // `String.raw` rather than a quoted literal: the escape sequence is one
  // backslash and one double quote, which the quote style rules disagree about
  // how to spell.
  const quoted = `"${escaped.replace(/"/g, String.raw`\"`)}"`;

  if (kind === "symbol") {
    return isBareSymbol(escaped) ? escaped : `symbol(${quoted})`;
  }
  return quoted;
};

/**
 * One piece of a rendered `SCVal`. A `value` token is a single scalar and
 * carries the arm it came from, so the signing screen can offer its type
 * without spelling that type out inline; `punct` is the structure around it.
 *
 * Both the string form and the rendered form are built from this one stream,
 * so what is copied and what is shown cannot drift apart.
 */
export type DisplayToken =
  | { kind: "value"; text: string; scValType: string }
  | { kind: "punct"; text: string };

const punct = (text: string): DisplayToken => ({ kind: "punct", text });

const value = (text: string, scValType: string): DisplayToken => ({
  kind: "value",
  text,
  scValType,
});

type DisplayOpts = { depth?: number; compact?: boolean };

/**
 * Wraps already-rendered lines in `{ }` or `[ ]`, one signed entry per line
 * unless `compact`.
 */
const joinLines = (
  lines: DisplayToken[][],
  open: string,
  close: string,
  {
    depth,
    compact,
    compactPad,
  }: {
    depth: number;
    compact: boolean;
    compactPad: string;
  },
): DisplayToken[] => {
  const pad = DISPLAY_INDENT.repeat(depth);
  const innerPad = DISPLAY_INDENT.repeat(depth + 1);
  const opened = compact
    ? punct(`${open}${compactPad}`)
    : punct(`${open}\n${innerPad}`);
  const separator = compact ? punct(", ") : punct(`,\n${innerPad}`);
  const closed = compact
    ? punct(`${compactPad}${close}`)
    : punct(`\n${pad}${close}`);

  const tokens: DisplayToken[] = [opened];
  lines.forEach((line, index) => {
    if (index) {
      tokens.push(separator);
    }
    tokens.push(...line);
  });
  tokens.push(closed);
  return tokens;
};

/** Renders the `SCMap` entry list shared by `SCV_MAP` and instance storage. */
const mapEntriesToTokens = (
  entries: xdr.ScMapEntry[] | null,
  { depth = 0, compact = false }: DisplayOpts,
): DisplayToken[] => {
  if (!entries || !entries.length) {
    return [punct("{}")];
  }
  const lines = entries.map((entry) => [
    // Keys render compact so that one signed entry is always exactly one line.
    // The recursion here is mutual with `scValToDisplayTokens`, which is what
    // lets a container nest to any depth.
    /* eslint-disable @typescript-eslint/no-use-before-define */
    ...scValToDisplayTokens(entry.key, { compact: true }),
    punct(": "),
    ...scValToDisplayTokens(entry.val, { depth: depth + 1, compact }),
    /* eslint-enable @typescript-eslint/no-use-before-define */
  ]);
  return joinLines(lines, "{", "}", { depth, compact, compactPad: " " });
};

/**
 * Renders a `ContractExecutable`, arms with a payload included.
 *
 * Naming the arm alone drops the CAP-85 external reference's owner and tag —
 * the two fields that say whose code is about to run — which is exactly what
 * the signer is being asked to approve.
 */
const executableToTokens = (
  executable: xdr.ContractExecutable,
  { depth = 0, compact = false }: DisplayOpts,
): DisplayToken[] => {
  switch (executable.type) {
    case "contractExecutableWasm": {
      const wasmHash = xdr.encodeBytes(executable.wasmHash.toBytes(), "hex");
      return [
        punct("wasm("),
        value(`0x${wasmHash}`, executable.type),
        punct(")"),
      ];
    }

    case "contractExecutableExternalRef": {
      const ref = executable.externalRef;
      const lines = [
        [
          punct("owner: "),
          value(addressToString(ref.executableOwner), executable.type),
        ],
        [punct("tag: "), value(xdrStringToDisplay(ref.tag), executable.type)],
      ];
      return [
        punct("externalRef "),
        ...joinLines(lines, "{", "}", { depth, compact, compactPad: " " }),
      ];
    }

    default: {
      return [value(executable.type, executable.type)];
    }
  }
};

/**
 * Renders an `SCVal` as a stream of display tokens.
 *
 * Deliberately does *not* route containers through `scValToNative()`. That
 * decoder builds maps with `Object.fromEntries`, which coerces every key
 * through `ToPropertyKey` and lets a later entry overwrite an earlier one, so
 * an SCMap with N signed entries can render as one — silently, with no glyph
 * and no warning, on the screen the user approves from. Here the map arm walks
 * the signed entry list directly, so every signed entry reaches the screen.
 *
 * Quoting carries some of the type: strings are quoted where symbols and
 * numbers are bare. The rest of it rides on each `value` token's `scValType`
 * rather than being spelled out inline, which keeps the common case — a
 * symbol-keyed struct — readable.
 */
export const scValToDisplayTokens = (
  scVal: xdr.ScVal,
  { depth = 0, compact = false }: DisplayOpts = {},
): DisplayToken[] => {
  switch (scVal.type) {
    case "scvMap": {
      return mapEntriesToTokens(scVal.map, { depth, compact });
    }

    case "scvVec": {
      const values = scVal.vec || [];
      if (!values.length) {
        return [punct("[]")];
      }
      const lines = values.map((entry) =>
        scValToDisplayTokens(entry, { depth: depth + 1, compact }),
      );
      return joinLines(lines, "[", "]", { depth, compact, compactPad: "" });
    }

    case "scvString": {
      return [value(xdrStringToLiteral(scVal.str, "string"), scVal.type)];
    }

    case "scvSymbol": {
      return [value(xdrStringToLiteral(scVal.sym, "symbol"), scVal.type)];
    }

    case "scvExecutableTag": {
      return [value(xdrStringToDisplay(scVal.executableTag), scVal.type)];
    }

    case "scvBytes": {
      const bytes = xdr.encodeBytes(scVal.bytes.toBytes(), "hex");
      return [value(`0x${bytes}`, scVal.type)];
    }

    case "scvAddress": {
      return [value(addressToString(scVal.address), scVal.type)];
    }

    case "scvBool": {
      return [value(`${scVal.b}`, scVal.type)];
    }

    case "scvLedgerKeyNonce": {
      return [value(scVal.nonceKey.nonce.toString(), scVal.type)];
    }

    case "scvContractInstance": {
      const { executable, storage } = scVal.instance;
      const lines = [
        [
          punct("executable: "),
          ...executableToTokens(executable, { depth: depth + 1, compact }),
        ],
      ];

      // `storage` is an optional pointer, so no storage and empty storage are
      // two different signed values. Two instances sharing an executable are
      // told apart by this map alone, so it has to reach the screen.
      if (storage) {
        lines.push([
          punct("storage: "),
          ...mapEntriesToTokens(storage, { depth: depth + 1, compact }),
        ]);
      }

      return [
        punct("contractInstance "),
        ...joinLines(lines, "{", "}", { depth, compact, compactPad: " " }),
      ];
    }

    case "scvError": {
      const error = scValToNative(scVal) as {
        type: string;
        code: number;
        value?: string;
      };
      return [
        value(`error(${error.type}:${error.value ?? error.code})`, scVal.type),
      ];
    }

    case "scvTimepoint":
    case "scvDuration":
    case "scvI128":
    case "scvI256":
    case "scvI32":
    case "scvI64":
    case "scvU128":
    case "scvU256":
    case "scvU32":
    case "scvU64": {
      return [value(scValToNative(scVal).toString(), scVal.type)];
    }

    case "scvVoid": {
      return [value("void", scVal.type)];
    }

    case "scvLedgerKeyContractInstance": {
      return [value("ledgerKeyContractInstance", scVal.type)];
    }

    default: {
      return [value("null", (scVal as xdr.ScVal).type)];
    }
  }
};

/**
 * The string form of {@link scValToDisplayTokens}, used wherever the value has
 * to be plain text — the clipboard, most obviously.
 */
export const scValToDisplayValue = (
  scVal: xdr.ScVal,
  opts: DisplayOpts = {},
): string =>
  scValToDisplayTokens(scVal, opts)
    .map((token) => token.text)
    .join("");

export const getArgsForTokenInvocation = (
  fnName: string,
  args: xdr.ScVal[],
): ArgsForTokenInvocation => {
  let tokenId: number | undefined;
  let amount: bigint | number | undefined;
  let from = "";
  let to = "";

  const thirdArgType = args[2].type;
  switch (fnName) {
    case SorobanTokenInterface.transfer:
      // both SEP-41 & SEP-50 tokens use the transfer method
      // with different signatures. Without parsing the token spec,
      // we can guess that the contract is either a token or a collectible
      // by the type of the 3rd argument.
      // Token transfer - (from: Address, to: Address, amount: i128)
      // Collectible transfer - (from: Address, to: Address, tokenId: u32)
      if (thirdArgType === "scvI128") {
        amount = scValToNative(args[2]);
      }
      if (thirdArgType === "scvU32") {
        tokenId = scValToNative(args[2]);
      }

      from = addressToString(scValToAddress(args[0]));
      to = addressToString(scValToAddress(args[1]));
      break;
    case SorobanTokenInterface.mint:
      to = addressToString(scValToAddress(args[0]));
      amount = scValToNative(args[1]);
      break;
    default:
      amount = BigInt(0);
  }

  return { from, to, amount, tokenId };
};

export const getTokenInvocationArgs = (
  hostFn: Operation.InvokeHostFunction,
): TokenInvocationArgs | null => {
  const func = hostFn?.func;
  if (!func || func.type !== "hostFunctionTypeInvokeContract") {
    return null;
  }

  const invokedContract: xdr.InvokeContractArgs = func.invokeContract;

  const contractId = Address.fromScAddress(
    invokedContract.contractAddress,
  ).toString();
  // A function name is a byte string, not guaranteed text. Decode it strictly
  // rather than leniently: a binary name can never be one of the token
  // interfaces, so treat it as "not a token invocation" instead of matching on
  // a lossily decoded string.
  const fnName = xdrStringToRaw(invokedContract.functionName);
  const { args } = invokedContract;

  if (fnName === undefined) {
    return null;
  }

  if (
    fnName !== SorobanTokenInterface.transfer &&
    fnName !== SorobanTokenInterface.mint
  ) {
    return null;
  }

  let opArgs: ArgsForTokenInvocation;

  try {
    opArgs = getArgsForTokenInvocation(fnName, args);
  } catch (e) {
    return null;
  }

  return {
    fnName,
    contractId,
    ...opArgs,
  };
};

export const isSorobanOp = (
  operation: Horizon.ServerApi.OperationRecord | OperationRecord,
) => SOROBAN_OPERATION_TYPES.includes(operation.type);

export const hasSorobanOperations = (
  transaction: ReturnType<typeof TransactionBuilder.fromXdr>,
) => transaction.operations.some((operation) => isSorobanOp(operation));

export const getAttrsFromSorobanHorizonOp = (
  operation: Horizon.ServerApi.OperationRecord,
  networkDetails: NetworkDetails,
) => {
  if (!isSorobanOp(operation)) {
    return null;
  }

  const op = operation as any;

  if (op.transaction_attr.contractId) {
    return {
      contractId: op.transaction_attr.contractId,
      fnName: op.transaction_attr.fnName,
      ...op.transaction_attr.args,
    };
  }

  const transaction = TransactionBuilder.fromXdr(
    op.transaction_attr.envelope_xdr as string,
    networkDetails.networkPassphrase,
  ) as Transaction;

  // only one op per tx in Soroban right now
  const invokeHostFn = transaction
    .operations[0] as Operation.InvokeHostFunction;

  return getTokenInvocationArgs(invokeHostFn);
};

/**
 * Derive a classic asset's Stellar Asset Contract (SAC) C-address. The SAC
 * address is deterministic — same (code, issuer, network) always resolves
 * to the same C-address, regardless of whether the asset has been wrapped
 * on-chain yet.
 *
 * Throws via `new SdkToken(...)` for invalid input (e.g. asset code longer
 * than 12 chars). Callers that pass user-supplied codes/issuers should
 * guard with a try/catch.
 */
export const getTokenSacAddress = (
  tokenCode: string,
  issuer: string,
  networkPassphrase: string,
) => new SdkToken(tokenCode, issuer).contractId(networkPassphrase);

/*
  Attempts to match a balance to a related contract ID, expects a token or SAC contract ID.
*/
export const getBalanceByKey = (
  contractId: string,
  balances: Balance[],
  networkDetails: NetworkDetails,
) => {
  const foundBalance = balances.find((balance) => {
    const matchesIssuer =
      "contractId" in balance && contractId === balance.contractId;

    try {
      // The native arm is entered only for the native-typed balance; every
      // other balance is matched by its own SAC below.
      if ("token" in balance && isNativeToken(balance.token)) {
        return isNativeContract(contractId, networkDetails.networkPassphrase);
      }

      // if issuer is a G address, check for a SAC match
      if (
        "token" in balance &&
        "issuer" in balance.token &&
        !isContractId(balance.token.issuer.key)
      ) {
        const sacAddress = getTokenSacAddress(
          balance.token.code,
          balance.token.issuer.key,
          networkDetails.networkPassphrase,
        );
        const matchesSac = contractId === sacAddress;
        return matchesSac;
      }
    } catch (e) {
      logger.error("getBalanceByKey", "Error checking for SAC match", e);
    }
    return matchesIssuer;
  });

  return foundBalance;
};

// Adopted from https://github.com/ethers-io/ethers.js/blob/master/packages/bignumber/src.ts/fixednumber.ts#L27
export const formatTokenForDisplay = (amount: BigNumber, decimals: number) => {
  let formatted = amount.toString();

  if (decimals > 0) {
    formatted = amount.shiftedBy(-decimals).toFixed(decimals).toString();

    // Trim trailing zeros
    while (formatted[formatted.length - 1] === "0") {
      formatted = formatted.substring(0, formatted.length - 1);
    }

    if (formatted.endsWith(".")) {
      formatted = formatted.substring(0, formatted.length - 1);
    }
  }

  return formatted;
};

export const INVOCATION_TYPE_INVOKE = "invoke" as const;
export const INVOCATION_TYPE_WASM = "wasm" as const;
export const INVOCATION_TYPE_SAC = "sac" as const;
/** CAP-85 (Protocol 28): contract created from an external executable reference. */
export const INVOCATION_TYPE_EXTERNAL_REF = "externalRef" as const;
/** An invocation whose contents could not be decoded. */
export const INVOCATION_TYPE_UNRECOGNIZED = "unrecognized" as const;

export interface FnArgsInvoke {
  type: typeof INVOCATION_TYPE_INVOKE;
  /** The escaped display form — what is drawn, never a lookup key. */
  fnName: string;
  /**
   * The raw signed function name, for the contract-spec lookup. Deliberately
   * separate from `fnName`: that one is escaped for the screen, and an escaped
   * string is not a name any spec defines. `undefined` when the signed bytes
   * are not text, which skips the lookup rather than keying it off something
   * no contract declared.
   */
  fnNameRaw?: string;
  contractId: string;
  args: xdr.ScVal[];
}

export interface FnArgsCreateWasm {
  type: typeof INVOCATION_TYPE_WASM;
  salt: string;
  hash: string;
  address: string;
  args?: xdr.ScVal[];
}

export interface FnArgsCreateSac {
  type: typeof INVOCATION_TYPE_SAC;
  asset: string;
  args?: xdr.ScVal[];
}

/**
 * A CAP-85 (Protocol 28) contract creation whose executable is a reference
 * into another contract's storage rather than a wasm hash. `owner` and `tag`
 * identify the reference; the code behind it is chosen by the owner at
 * invocation time and can change after this entry is signed, so there is
 * deliberately no wasm hash here. `tag` is the SEP-51 JSON form of the
 * SCString so a non-UTF-8 tag stays distinguishable (e.g. `\xff\xfe`) instead
 * of collapsing to replacement characters.
 */
export interface FnArgsCreateExternalRef {
  type: typeof INVOCATION_TYPE_EXTERNAL_REF;
  owner: string;
  tag: string;
  address: string;
  salt: string;
  args?: xdr.ScVal[];
}

/** An invocation whose contents we could not decode. */
export interface FnArgsUnrecognized {
  type: typeof INVOCATION_TYPE_UNRECOGNIZED;
}

export type InvocationArgs =
  | FnArgsInvoke
  | FnArgsCreateWasm
  | FnArgsCreateSac
  | FnArgsCreateExternalRef
  | FnArgsUnrecognized;

const isInvocationArg = (
  invocation: InvocationArgs | undefined,
): invocation is InvocationArgs => !!invocation;

/**
 * Decodes a single authorized invocation into the shape the signing screens
 * render.
 *
 * Returns `undefined` for function types we do not render. For contract
 * creations, decodes the wasm, Stellar-asset, and CAP-85 (Protocol 28)
 * external-reference executables; the `externalRef` arm reports the owner and
 * tag but deliberately no wasm hash, since the owner can change the code the
 * reference resolves to after signing.
 *
 * Throws when the creation is not something we can safely describe: an
 * executable paired with the wrong contract-id preimage (wasm or external ref
 * without an address preimage, Stellar asset without an asset preimage), or an
 * executable type this build does not know. Callers that must not fail the
 * whole view should catch and substitute `FnArgsUnrecognized` (see
 * `getInvocationDetails`).
 */
export const getInvocationArgs = (
  invocation: xdr.SorobanAuthorizedInvocation,
): InvocationArgs | undefined => {
  const fn = invocation.function;

  switch (fn.type) {
    case "sorobanAuthorizedFunctionTypeContractFn": {
      const invocationItem = fn.contractFn;
      const contractId = Address.fromScAddress(
        invocationItem.contractAddress,
      ).toString();
      const fnName = xdrStringToDisplay(invocationItem.functionName);
      const fnNameRaw = xdrStringToRaw(invocationItem.functionName);
      const { args } = invocationItem;
      return {
        fnName,
        fnNameRaw,
        contractId,
        args,
        type: INVOCATION_TYPE_INVOKE,
      };
    }

    case "sorobanAuthorizedFunctionTypeCreateContractV2HostFn":
    case "sorobanAuthorizedFunctionTypeCreateContractHostFn": {
      const isCreateV2 =
        fn.type === "sorobanAuthorizedFunctionTypeCreateContractV2HostFn";
      const invocationItem: xdr.CreateContractArgs | xdr.CreateContractArgsV2 =
        fn.type === "sorobanAuthorizedFunctionTypeCreateContractV2HostFn"
          ? fn.createContractV2HostFn
          : fn.createContractHostFn;
      const exec = invocationItem.executable;
      const preimage = invocationItem.contractIdPreimage;

      switch (exec.type) {
        case "contractExecutableWasm": {
          // A wasm executable must be paired with an address preimage: the
          // contract id is derived from deployer + salt. The two arms are
          // independent in XDR, so the invalid pairings are representable.
          if (preimage.type !== "contractIdPreimageFromAddress") {
            throw new Error(
              `creation function appears invalid: a wasm executable is paired with ${preimage.type} (should be wasm+address or token+asset)`,
            );
          }
          const details = preimage.fromAddress;

          const contractDetails = {
            type: INVOCATION_TYPE_WASM,
            salt: xdr.encodeBytes(details.salt.toBytes(), "hex"),
            hash: xdr.encodeBytes(exec.wasmHash.toBytes(), "hex"),
            address: Address.fromScAddress(details.address).toString(),
          } as FnArgsCreateWasm;

          if (isCreateV2) {
            contractDetails.args = (
              invocationItem as xdr.CreateContractArgsV2
            ).constructorArgs;
          }

          return contractDetails;
        }

        case "contractExecutableStellarAsset": {
          // A SAC is only ever derived from the asset it wraps.
          if (preimage.type !== "contractIdPreimageFromAsset") {
            throw new Error(
              `creation function appears invalid: a Stellar asset executable is paired with ${preimage.type} (should be wasm+address or token+asset)`,
            );
          }
          const sacDetails = {
            type: INVOCATION_TYPE_SAC,
            asset: SdkToken.fromOperation(preimage.fromAsset).toString(),
          } as FnArgsCreateSac;

          if (isCreateV2) {
            sacDetails.args = (
              invocationItem as xdr.CreateContractArgsV2
            ).constructorArgs;
          }

          return sacDetails;
        }

        // CAP-85 (Protocol 28): the executable is a reference to a Wasm hash
        // held by another contract, resolved on-chain at creation time.
        case "contractExecutableExternalRef": {
          // Like wasm, an external reference deploys from an address; the SDK's
          // own invocation decoder rejects every other pairing, so do the same
          // rather than rendering an invalid authorization as a normal
          // contract creation.
          if (preimage.type !== "contractIdPreimageFromAddress") {
            throw new Error(
              `creation function appears invalid: an external executable reference is paired with ${preimage.type} (should be wasm+address, external ref+address, or token+asset)`,
            );
          }
          const details = preimage.fromAddress;
          const { executableOwner, tag } = exec.externalRef;

          const externalRefDetails = {
            type: INVOCATION_TYPE_EXTERNAL_REF,
            owner: Address.fromScAddress(executableOwner).toString(),
            // Strict decode, falling back to the reversible SEP-51 form only
            // for bytes that are not valid UTF-8.
            tag: xdrStringToDisplay(tag),
            address: Address.fromScAddress(details.address).toString(),
            salt: xdr.encodeBytes(details.salt.toBytes(), "hex"),
          } as FnArgsCreateExternalRef;

          if (isCreateV2) {
            externalRefDetails.args = (
              invocationItem as xdr.CreateContractArgsV2
            ).constructorArgs;
          }

          return externalRefDetails;
        }

        default:
          throw new Error(`unknown creation type: ${JSON.stringify(exec)}`);
      }
    }

    default: {
      return undefined;
    }
  }
};

export const getInvocationDetails = (
  invocation: xdr.SorobanAuthorizedInvocation,
): InvocationArgs[] => {
  const invocations = [] as InvocationArgs[];

  walkInvocationTree(invocation, (inv) => {
    try {
      const args = getInvocationArgs(inv);
      if (args) {
        invocations.push(args);
      }
    } catch (error) {
      // An invocation we cannot decode must not take down the whole signing
      // view -- surface it so the user sees that something was unreadable.
      //
      // `error` rather than `warn` (unlike the XDR-parse failures upstream):
      // the XDR itself parsed, so reaching here means either our decoder is
      // missing an executable/preimage arm the network now accepts, or a dApp
      // is asking the user to sign a creation the SDK considers invalid. Both
      // warrant an engineer's attention, and volume is bounded by user-initiated
      // sign requests.
      logger.error("soroban", "Failed to decode authorized invocation", error);
      invocations.push({ type: INVOCATION_TYPE_UNRECOGNIZED });
    }

    return null;
  });

  return invocations.filter(isInvocationArg);
};

/**
 * Renders an `SCVal` as a bare scalar string — the per-type projection used
 * where a value literal's quoting would be noise rather than signal.
 *
 * Every arm returns a string. An arm that returns `undefined` or `null` here
 * reaches the signing screen as an empty row: `<Text>{undefined}</Text>`
 * renders nothing at all, so a signed `false` would be indistinguishable from
 * no value having been signed.
 */
export const scValByType = (scVal: xdr.ScVal): string => {
  switch (scVal.type) {
    case "scvAddress": {
      return addressToString(scVal.address);
    }

    case "scvBool": {
      return `${scVal.b}`;
    }

    case "scvBytes": {
      return `0x${xdr.encodeBytes(scVal.bytes.toBytes(), "hex")}`;
    }

    case "scvContractInstance": {
      // A non-wasm arm used to return `undefined`, i.e. an empty row; naming
      // the arm alone still dropped the storage map and the external
      // reference's owner and tag.
      return scValToDisplayValue(scVal);
    }

    case "scvError": {
      return String(scVal.error.value);
    }

    case "scvTimepoint":
    case "scvDuration":
    case "scvI128":
    case "scvI256":
    case "scvI32":
    case "scvI64":
    case "scvU128":
    case "scvU256":
    case "scvU32":
    case "scvU64": {
      return scValToNative(scVal).toString();
    }

    case "scvLedgerKeyNonce": {
      return scVal.nonceKey.nonce.toString();
    }

    case "scvLedgerKeyContractInstance": {
      return "ledgerKeyContractInstance";
    }

    case "scvVec":
    case "scvMap": {
      return scValToDisplayValue(scVal);
    }

    // CAP-85 (Protocol 28): an executable tag is an SCString, so it is not
    // guaranteed text. It is escaped rather than decoded leniently, so two
    // distinct binary tags cannot collapse onto one screen string.
    case "scvExecutableTag": {
      return xdrStringToDisplay(scVal.executableTag);
    }

    case "scvString": {
      return xdrStringToDisplay(scVal.str);
    }

    case "scvSymbol": {
      return xdrStringToDisplay(scVal.sym);
    }

    case "scvVoid": {
      return "void";
    }

    // Exhaustive today; a future arm should still name itself rather than
    // reach the signing screen as an empty row.
    default:
      return (scVal as xdr.ScVal).type;
  }
};

export const getCreateContractArgs = (hostFunction: xdr.HostFunction) => {
  if (hostFunction.type !== "hostFunctionTypeCreateContractV2") {
    // Pre-v17 the generated `createContract()` arm accessor threw for any
    // other host function type; keep that contract.
    const args = xdr.expectUnionVariant(
      hostFunction,
      "hostFunctionTypeCreateContract",
    ).createContract;

    return {
      contractIdPreimage: args.contractIdPreimage,
      executable: args.executable,
    };
  }

  const argsV2 = hostFunction.createContractV2;

  return {
    contractIdPreimage: argsV2.contractIdPreimage,
    executable: argsV2.executable,
    constructorArgs: argsV2.constructorArgs,
  };
};

/**
 * The slice of a `Spec.jsonSchema()` payload the wallet actually reads.
 *
 * A compile-time description of the response, not validation of it: the spec is
 * untrusted JSON, and every consumer guards the values it takes from here.
 */
export interface ContractFnArgsSchema {
  // The ordered parameter list. `required` is the subset that must be present,
  // so it omits `Option<T>` parameters -- never read it as the parameter list.
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface ContractFnDefinition {
  properties?: { args?: ContractFnArgsSchema };
}

export interface ContractSpecSchema {
  definitions?: Record<string, ContractFnDefinition | undefined>;
}

// V8 hoists integer-like keys to the front of `Object.keys` and sorts them
// numerically, so their presence alone means the key order is not insertion
// order. No Rust identifier looks like this, but the spec section is
// author-controlled metadata and can hold any string.
const INTEGER_LIKE_KEY = /^(0|[1-9]\d*)$/;

/**
 * Argument names for a contract function, in declaration order, or `null` when
 * the spec does not describe the invocation we were handed.
 *
 * The ordered parameter list is `properties.args.properties`, never `required`:
 * `Spec.jsonSchema()` follows JSON Schema semantics, so an `Option<T>`
 * parameter is left out of `required` and every name after it would attach to
 * the wrong value.
 *
 * Reading the parameter list off object keys is sound here because nothing in
 * the path reorders them: `Spec.jsonSchema()` fills `properties` from a single
 * pass over the function's inputs, and `JSON.stringify` and `JSON.parse` both
 * preserve insertion order for keys that are not integer-like. The two guards
 * below cover the cases where that breaks down -- an arity mismatch, and keys
 * `Object.keys` would reorder. A re-serializer that sorted the keys is not
 * detectable from this payload; the followup is for `/contract-spec` to return
 * an explicit ordered array derived from `inputs()`, so order is carried rather
 * than inferred.
 *
 * These names come from author-controlled wasm metadata, so they are advisory
 * either way -- the signing view says as much beside them.
 */
export const getContractFnArgNames = (
  spec: ContractSpecSchema | undefined,
  fnName: string,
  argCount: number,
): string[] | null => {
  const names = Object.keys(
    spec?.definitions?.[fnName]?.properties?.args?.properties ?? {},
  );

  if (names.length !== argCount) {
    return null;
  }

  if (names.some((name) => INTEGER_LIKE_KEY.test(name))) {
    return null;
  }

  return names;
};
