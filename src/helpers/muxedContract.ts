/**
 * Muxed contract addresses (`W…`, SEP-23): a contract ID (`C…`) paired with a
 * 64-bit mux id, the contract counterpart of the muxed account (`M…`).
 *
 * Leaf module: it imports only from `@stellar/stellar-sdk`, never from
 * `helpers/stellar` or `helpers/soroban`. `stellar.ts` already imports
 * `soroban.ts`, and both need to call these helpers, so a back-import here
 * would close an import cycle.
 */
import {
  encodeMuxedContractAddress,
  extractBaseAddress,
  StrKey,
} from "@stellar/stellar-sdk";

/**
 * A decoded `W…` payload is 40 bytes: the 32-byte contract ID, then the 8-byte
 * big-endian mux id. These bound the id, with the end exclusive.
 */
const MUX_ID_START = 32;
const MUX_ID_END = 40;

/**
 * Checks if an address is a muxed contract address (`W…`).
 *
 * Validates the whole strkey, so a mistyped `W…` is rejected: a last
 * character whose base32 padding bit is set fails, and so does a checksum
 * that does not match. Contract (`C…`), account (`G…`) and muxed account
 * (`M…`) addresses are not muxed contracts.
 *
 * @param address The address to check
 * @returns True if the address is a valid `W…`
 */
export const isMuxedContract = (address: string): boolean =>
  StrKey.isValidMuxedContract(address);

/**
 * Checks if an address is a contract destination: a contract (`C…`) or a
 * muxed contract (`W…`). Accounts (`G…`, `M…`) are not.
 *
 * @param address The address to check
 * @returns True if the address is a valid `C…` or `W…`
 */
export const isContractDestination = (address: string): boolean =>
  StrKey.isValidContract(address) || isMuxedContract(address);

/**
 * Throws unless the address is a valid `W…`. The getters below rely on it
 * because the SDK's `extractBaseAddress` also accepts `C…`, `G…` and `M…`, and
 * would return a base for those instead of failing.
 *
 * @param address The address to check
 * @throws Error if the address is not a valid `W…`
 */
const assertMuxedContract = (address: string): void => {
  if (!isMuxedContract(address)) {
    throw new Error("Not a muxed contract address");
  }
};

/**
 * Gets the base contract (`C…`) of a muxed contract address (`W…`).
 *
 * @param muxedContract A valid `W…` address
 * @returns The `C…` address the `W…` wraps
 * @throws Error if the address is not a valid `W…`
 */
export const getMuxedContractBaseId = (muxedContract: string): string => {
  assertMuxedContract(muxedContract);

  return extractBaseAddress(muxedContract);
};

/**
 * Gets the mux id of a muxed contract address (`W…`) as a decimal string.
 *
 * The id is a uint64, so it is read as a big-endian `BigInt` and returned as a
 * string. A `Number` would silently round anything above 2^53 - 1.
 *
 * @param muxedContract A valid `W…` address
 * @returns The mux id, from "0" to "18446744073709551615"
 * @throws Error if the address is not a valid `W…`
 */
export const getMuxedContractMuxId = (muxedContract: string): string => {
  assertMuxedContract(muxedContract);

  const payload = StrKey.decodeMuxedContract(muxedContract);
  let muxId = BigInt(0);

  for (let i = MUX_ID_START; i < MUX_ID_END; i++) {
    muxId = muxId * BigInt(256) + BigInt(payload[i]);
  }

  return muxId.toString();
};

/**
 * Builds a muxed contract address (`W…`) from a contract (`C…`) and a mux id.
 *
 * The id stays a decimal string, from "0" to "18446744073709551615", for the
 * same reason `getMuxedContractMuxId` returns one. The SDK rejects anything
 * else (hex, signs, whitespace, out of range) and drops leading zeros.
 *
 * @param contractId A valid `C…` address
 * @param muxId The mux id as a decimal uint64 string
 * @returns The `W…` address
 * @throws Error if the contract or the id is invalid
 */
export const buildMuxedContract = (contractId: string, muxId: string): string =>
  encodeMuxedContractAddress(contractId, muxId);
