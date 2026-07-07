import { Keypair } from "@stellar/stellar-sdk";
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

const b64url = (b: Buffer): string =>
  b
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const seg = (v: unknown): string =>
  b64url(Buffer.from(JSON.stringify(v), "utf8"));

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
    sub: keypair.rawPublicKey().toString("hex"),
    iss: ISS,
    iat,
    exp: iat + JWT_LIFETIME_SECONDS,
    bodyHash,
    methodAndPath: `${method.toUpperCase()} ${path}`,
  };
  const signingInput = `${seg({ alg: "EdDSA", typ: "JWT" })}.${seg(payload)}`;
  return `${signingInput}.${b64url(keypair.sign(Buffer.from(signingInput, "utf8")))}`;
};
