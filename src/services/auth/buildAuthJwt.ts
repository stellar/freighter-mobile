import { Keypair, xdr } from "@stellar/stellar-sdk";
import { createHash } from "crypto";

export const ISS = "freighter-mobile";
export const JWT_LIFETIME_SECONDS = 15;

export interface BuildAuthJwtParams {
  keypair: Keypair;
  method: string;
  path: string; // full request-target incl. query, e.g. "/api/v1/auth/whoami"
  body?: string; // pre-serialized; omit for GET
  now?: number; // ms epoch; injectable for tests
}

// v17: Keypair.sign / rawPublicKey return Uint8Array (not Buffer), whose
// `toString("base64")` would silently yield comma-joined decimals.
const b64url = (b: Uint8Array): string =>
  xdr
    .encodeBytes(b, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const seg = (v: unknown): string =>
  b64url(Buffer.from(JSON.stringify(v), "utf8"));

// The header is constant for every token — compute it once at module load
// rather than re-running JSON.stringify + base64 + three regex replaces per
// authenticated request.
const HEADER_SEG = seg({ alg: "EdDSA", typ: "JWT" });

export const buildAuthJwt = ({
  keypair,
  method,
  path,
  body,
  now,
}: BuildAuthJwtParams): string => {
  const iat = Math.floor((now ?? Date.now()) / 1000);
  const bodyHash = createHash("sha256")
    .update(body ?? "")
    .digest("hex");
  const payload = {
    sub: xdr.encodeBytes(keypair.rawPublicKey(), "hex"),
    iss: ISS,
    iat,
    exp: iat + JWT_LIFETIME_SECONDS,
    bodyHash,
    methodAndPath: `${method.toUpperCase()} ${path}`,
  };
  const signingInput = `${HEADER_SEG}.${seg(payload)}`;
  return `${signingInput}.${b64url(keypair.sign(Buffer.from(signingInput, "utf8")))}`;
};
