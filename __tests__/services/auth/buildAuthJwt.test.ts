import { Keypair, xdr } from "@stellar/stellar-sdk";
import {
  ISS,
  JWT_LIFETIME_SECONDS,
  buildAuthJwt,
} from "services/auth/buildAuthJwt";

// Fixed test fixtures
const SEED = Buffer.alloc(32, 7);
const keypair = Keypair.fromRawEd25519Seed(SEED);
const NOW = 1_700_000_000_000;

const b64urlDecode = (s: string): Buffer =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

describe("buildAuthJwt", () => {
  it("exports ISS = 'freighter-mobile'", () => {
    expect(ISS).toBe("freighter-mobile");
  });

  it("exports JWT_LIFETIME_SECONDS = 15", () => {
    expect(JWT_LIFETIME_SECONDS).toBe(15);
  });

  describe("JWT structure", () => {
    let token: string;
    let headerJson: Record<string, unknown>;
    let payloadJson: Record<string, unknown>;
    let sigBytes: Buffer;
    let headerSeg: string;
    let payloadSeg: string;

    beforeEach(() => {
      token = buildAuthJwt({
        keypair,
        method: "get",
        path: "/api/v1/auth/whoami",
        now: NOW,
      });
      const parts = token.split(".");
      expect(parts).toHaveLength(3);
      [headerSeg, payloadSeg] = parts;
      headerJson = JSON.parse(
        b64urlDecode(parts[0]).toString("utf8"),
      ) as Record<string, unknown>;
      payloadJson = JSON.parse(
        b64urlDecode(parts[1]).toString("utf8"),
      ) as Record<string, unknown>;
      sigBytes = b64urlDecode(parts[2]);
    });

    it("has EdDSA header", () => {
      expect(headerJson).toEqual({ alg: "EdDSA", typ: "JWT" });
    });

    it("has sub = raw public key hex", () => {
      expect(payloadJson.sub).toBe(
        xdr.encodeBytes(keypair.rawPublicKey(), "hex"),
      );
    });

    it("has iss = 'freighter-mobile'", () => {
      expect(payloadJson.iss).toBe("freighter-mobile");
    });

    it("has iat derived from now", () => {
      expect(payloadJson.iat).toBe(Math.floor(NOW / 1000));
    });

    it("has exp - iat === 15", () => {
      expect((payloadJson.exp as number) - (payloadJson.iat as number)).toBe(
        15,
      );
    });

    it("has methodAndPath = 'GET /api/v1/auth/whoami'", () => {
      expect(payloadJson.methodAndPath).toBe("GET /api/v1/auth/whoami");
    });

    it("upper-cases the method", () => {
      const t = buildAuthJwt({
        keypair,
        method: "post",
        path: "/foo",
        now: NOW,
      });
      const p = JSON.parse(
        b64urlDecode(t.split(".")[1]).toString("utf8"),
      ) as Record<string, unknown>;
      expect(p.methodAndPath).toBe("POST /foo");
    });

    it("has empty-body SHA-256 when no body is supplied", () => {
      expect(payloadJson.bodyHash).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      );
    });

    it("has correct SHA-256 for body = 'hello'", () => {
      const t = buildAuthJwt({
        keypair,
        method: "POST",
        path: "/foo",
        body: "hello",
        now: NOW,
      });
      const p = JSON.parse(
        b64urlDecode(t.split(".")[1]).toString("utf8"),
      ) as Record<string, unknown>;
      expect(p.bodyHash).toBe(
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
      );
    });

    it("signature verifies against signing input", () => {
      const signingInput = Buffer.from(`${headerSeg}.${payloadSeg}`, "utf8");
      expect(keypair.verify(signingInput, sigBytes)).toBe(true);
    });

    it("is url-safe: no +, /, or = characters", () => {
      expect(token).not.toMatch(/[+/=]/);
    });
  });
});
