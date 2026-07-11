/**
 * Gated E2E integration test: round-trips a real JWT against the staging
 * backend's /api/v1/auth/whoami route.
 *
 * HOW TO RUN:
 *   BACKEND_V2_URL=https://freighter-backend-v2-stg.stellar.org \
 *     yarn jest __tests__/services/auth/authJwt.integration.test.ts
 *
 * Or with the IS_INTEGRATION_MODE flag (uses the staging URL by default):
 *   IS_INTEGRATION_MODE=1 yarn jest __tests__/services/auth/authJwt.integration.test.ts
 *
 * Normal CI: suite is SKIPPED — set neither env var and all tests are omitted.
 */
import { AUTH_KEYPAIR_VECTORS } from "services/auth/authKeypairVectors";
import { buildAuthJwt } from "services/auth/buildAuthJwt";
import { deriveAuthKeypair } from "services/auth/deriveAuthKeypair";

// ---------------------------------------------------------------------------
// Gating: skip the whole suite unless an integration flag is present
// ---------------------------------------------------------------------------
const RUN = !!(process.env.BACKEND_V2_URL || process.env.IS_INTEGRATION_MODE);
const d = RUN ? describe : describe.skip;

const BASE_URL =
  process.env.BACKEND_V2_URL || "https://freighter-backend-v2-stg.stellar.org";

const WHOAMI_PATH = "/api/v1/auth/whoami";
const WHOAMI_URL = `${BASE_URL}${WHOAMI_PATH}`;

// Vector index 1 (0-based):
//   mnemonic: "illness spike retreat truth genius clock brain pass fit cave bargain toe"
//   userId:   "bd9498475c7191c5e9a5e18edda2402ab0ae527580a6c38b2a32a77c65729cd7"
const VECTOR = AUTH_KEYPAIR_VECTORS[1];

d("auth JWT e2e", () => {
  let keypair: Awaited<ReturnType<typeof deriveAuthKeypair>>["keypair"];
  let userId: string;

  beforeAll(async () => {
    // deriveAuthKeypair is async as of #920 (bip39 mnemonicToSeed off the JS thread).
    const derived = await deriveAuthKeypair(VECTOR.mnemonic);
    keypair = derived.keypair;
    userId = derived.userId;
  });

  it("valid JWT → 200 with authenticated:true and correct userId", async () => {
    const jwt = buildAuthJwt({
      keypair,
      method: "GET",
      path: WHOAMI_PATH,
    });

    const res = await fetch(WHOAMI_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(200);

    // The backend wraps successful responses in its standard `{ data: ... }`
    // envelope (verified against staging), so whoami is at body.data.
    const body = (await res.json()) as {
      data: { authenticated: boolean; userId: string };
    };
    expect(body.data.authenticated).toBe(true);
    expect(body.data.userId).toBe(userId);
    // Double-check against the hard-coded vector value for extra safety
    expect(body.data.userId).toBe(VECTOR.userId);
  });

  it("tampered body: JWT built with body hash mismatch → 401", async () => {
    // JWT claims a non-empty body but GET is sent with no body — server must
    // reject because the bodyHash in the token won't match the empty-body hash.
    const jwt = buildAuthJwt({
      keypair,
      method: "GET",
      path: WHOAMI_PATH,
      body: '{"tampered":true}',
    });

    const res = await fetch(WHOAMI_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(401);
  });

  it("flipped signature byte → 401", async () => {
    const jwt = buildAuthJwt({
      keypair,
      method: "GET",
      path: WHOAMI_PATH,
    });

    const parts = jwt.split(".");
    // Decode the signature segment, flip a byte, re-encode
    const sigBytes = Buffer.from(
      parts[2].replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    );
    sigBytes[0] = sigBytes[0] === 0 ? 1 : 0; // flip the first byte to something different
    const corruptedSig = sigBytes
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const corruptedJwt = `${parts[0]}.${parts[1]}.${corruptedSig}`;

    const res = await fetch(WHOAMI_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${corruptedJwt}` },
    });

    expect(res.status).toBe(401);
  });

  it("expired JWT → 401", async () => {
    // Build with now 60 seconds in the past so exp is already past
    const expiredNow = Date.now() - 60_000;
    const jwt = buildAuthJwt({
      keypair,
      method: "GET",
      path: WHOAMI_PATH,
      now: expiredNow,
    });

    const res = await fetch(WHOAMI_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${jwt}` },
    });

    expect(res.status).toBe(401);
  });
});
