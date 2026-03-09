/* eslint-disable @fnando/consistent-import/consistent-import */
/* eslint-disable no-console */
import { xdr, Keypair } from "@stellar/stellar-base";
import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";

import { MockWalletConnectClient } from "./walletconnect";

/**
 * Generate a fresh SorobanAuthorizationEntry XDR string for E2E testing.
 *
 * Produces a realistic DEX-deposit scenario with 4 nested invocations:
 *
 *   deposit(usdc, xlm, 100 USDC, 50 XLM, min_a, min_b, user, deadline)
 *   ├── approve(user, dex, 100 USDC, expiry=500_000)
 *   │   └── transfer_from(user, dex, 50 XLM)
 *   └── approve(user, dex, 50 XLM, expiry=500_000)
 *
 * Uses SorobanAddressCredentials with a fresh random keypair so each call
 * produces a unique, signable entry.
 *
 * stellar-base v14: xdr.PublicKey.publicKeyTypeEd25519 and
 * xdr.ScAddress.scAddressTypeContract accept opaque XDR byte-array types
 * (Buffer<ArrayBufferLike> / Hash). Buffer is wire-compatible; cast via
 * `as unknown` to bridge the branded-type gap.
 */
function generateSorobanAuthEntryXdr(): string {
  const kp = Keypair.random();

  type Ed25519Buf = Parameters<typeof xdr.PublicKey.publicKeyTypeEd25519>[0];
  type ContractBuf = Parameters<typeof xdr.ScAddress.scAddressTypeContract>[0];

  const contractBuf = (seed: number) =>
    Buffer.alloc(32, seed) as unknown as ContractBuf;

  const scContract = (seed: number) =>
    xdr.ScVal.scvAddress(
      xdr.ScAddress.scAddressTypeContract(contractBuf(seed)),
    );

  const scAcct = () =>
    xdr.ScVal.scvAddress(
      xdr.ScAddress.scAddressTypeAccount(
        xdr.PublicKey.publicKeyTypeEd25519(
          kp.rawPublicKey() as unknown as Ed25519Buf,
        ),
      ),
    );

  const i128 = (n: bigint) => {
    const base = 2n ** 64n;
    return xdr.ScVal.scvI128(
      new xdr.Int128Parts({
        hi: xdr.Int64.fromString((n / base).toString()),
        lo: xdr.Uint64.fromString((n % base).toString()),
      }),
    );
  };

  const u32 = (n: number) => xdr.ScVal.scvU32(n);

  const contractFn = (seed: number, fnName: string, args: xdr.ScVal[]) =>
    xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: xdr.ScAddress.scAddressTypeContract(contractBuf(seed)),
        functionName: fnName,
        args,
      }),
    );

  // Deepest: XLM token transfer_from(user, dex, 50 XLM)
  const xlmTransfer = new xdr.SorobanAuthorizedInvocation({
    function: contractFn(0x30, "transfer_from", [
      scAcct(),
      scContract(0x10),
      i128(500_000_000n),
    ]),
    subInvocations: [],
  });

  // Sub 1: USDC approve(user, dex, 100 USDC, expiry)
  const usdcApprove = new xdr.SorobanAuthorizedInvocation({
    function: contractFn(0x20, "approve", [
      scAcct(),
      scContract(0x10),
      i128(100_000_000n),
      u32(500_000),
    ]),
    subInvocations: [xlmTransfer],
  });

  // Sub 2: XLM approve(user, dex, 50 XLM, expiry)
  const xlmApprove = new xdr.SorobanAuthorizedInvocation({
    function: contractFn(0x30, "approve", [
      scAcct(),
      scContract(0x10),
      i128(500_000_000n),
      u32(500_000),
    ]),
    subInvocations: [],
  });

  // Root: DEX deposit(token_a, token_b, desired_a, desired_b, min_a, min_b, to, deadline)
  const rootInvocation = new xdr.SorobanAuthorizedInvocation({
    function: contractFn(0x10, "deposit", [
      scContract(0x20), // token_a (USDC)
      scContract(0x30), // token_b (XLM)
      i128(100_000_000n), // desired_a: 100 USDC (6 decimals)
      i128(500_000_000n), // desired_b: 50 XLM (7 decimals)
      i128(99_000_000n), // min_a: 99 USDC
      i128(490_000_000n), // min_b: 49 XLM
      scAcct(), // to
      u32(500_100), // deadline ledger
    ]),
    subInvocations: [usdcApprove, xlmApprove],
  });

  const entry = new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: xdr.ScAddress.scAddressTypeAccount(
          xdr.PublicKey.publicKeyTypeEd25519(
            kp.rawPublicKey() as unknown as Ed25519Buf,
          ),
        ),
        nonce: xdr.Int64.fromString("0"),
        signatureExpirationLedger: 999_999,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation,
  });

  return entry.toXDR("base64");
}

export function createRoutes(wcClient: MockWalletConnectClient): Router {
  const router = Router();

  // Store session metadata
  interface SessionResponse {
    id: string;
    type: "signMessage" | "signXDR" | "signAuthEntry";
    params: Record<string, string | number | undefined>;
    promise: Promise<unknown>;
    createdAt: number;
  }

  interface SessionMetadata {
    sessionId: string;
    topic: string;
    uri: string;
    deepLink: string;
    createdAt: number;
    responses: SessionResponse[];
  }

  const sessionMetadata = new Map<string, SessionMetadata>();

  /**
   * Health check
   */
  router.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: Date.now(),
      sessions: sessionMetadata.size,
    });
  });

  /**
   * Create a new WalletConnect session
   * POST /session/create
   */
  router.post("/session/create", async (_req: Request, res: Response) => {
    try {
      console.log("[API] 📡 POST /session/create - Starting...");
      const { uri, approval } = await wcClient.createSession();
      console.log(
        "[API] ✅ WalletConnect session created, URI:",
        `${uri.substring(0, 50)}...`,
      );

      const sessionId = `e2e-${Date.now()}`;
      const mobileScheme = process.env.MOBILE_APP_SCHEME || "freighterdev";
      const deepLink = `${mobileScheme}://wc?uri=${encodeURIComponent(uri)}`;
      console.log("[API] 📱 Deep link:", `${deepLink.substring(0, 80)}...`);

      // Store metadata before approval completes
      const metadata = {
        sessionId,
        topic: "", // Will be updated after approval
        uri,
        deepLink,
        createdAt: Date.now(),
        responses: [],
      };

      sessionMetadata.set(sessionId, metadata);
      console.log("[API] 💾 Session metadata stored:", sessionId);

      // Wait for approval in background
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      approval()
        .then((session) => {
          metadata.topic = session.topic;
          console.log(
            `[API] Session ${sessionId} approved with topic ${session.topic}`,
          );
        })
        .catch((error: unknown) => {
          console.error(`[API] Session ${sessionId} approval failed:`, error);
        });

      console.log("[API] 📤 Response sent:", {
        sessionId,
        deepLink: `${deepLink.substring(0, 50)}...`,
      });
      return res.json({
        sessionId,
        uri,
        deepLink,
        message: "Session created. Use URI or deepLink to connect wallet.",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[API] Failed to create session:", error);
      return res.status(500).json({
        error: "Failed to create session",
        message: errorMessage,
      });
    }
  });

  /**
   * Get session status
   * GET /session/:id
   */
  router.get("/session/:id", (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const metadata = sessionMetadata.get(id);

    if (!metadata) {
      return res.status(404).json({ error: "Session not found" });
    }

    const session = metadata.topic ? wcClient.getSession(metadata.topic) : null;

    return res.json({
      sessionId: metadata.sessionId,
      topic: metadata.topic || null,
      connected: !!session,
      session: session || null,
      createdAt: metadata.createdAt,
    });
  });

  /**
   * Wait for session approval
   * GET /session/:id/wait
   * Polls until session is approved or times out
   */
  router.get("/session/:id/wait", async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const timeout = parseInt(req.query.timeout as string, 10) || 30000; // 30s default
    const metadata = sessionMetadata.get(id);

    if (!metadata) {
      return res.status(404).json({ error: "Session not found" });
    }

    const startTime = Date.now();

    // Poll for topic (indicates approval)
    const checkApproval = async (): Promise<void> => {
      if (metadata.topic) {
        return; // Approved
      }

      if (Date.now() - startTime > timeout) {
        throw new Error("Timeout waiting for session approval");
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
      await checkApproval();
    };

    try {
      await checkApproval();

      const session = wcClient.getSession(metadata.topic);

      return res.json({
        sessionId: metadata.sessionId,
        topic: metadata.topic,
        connected: true,
        session,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return res.status(408).json({
        error: "Timeout",
        message: errorMessage,
      });
    }
  });

  const parseNetwork = (value: unknown): "testnet" | "pubnet" =>
    value === "pubnet" ? "pubnet" : "testnet";

  /**
   * Send stellar_signMessage request
   * POST /session/:id/request/signMessage
   */
  router.post(
    "/session/:id/request/signMessage",
    (req: Request, res: Response) => {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const { message } = req.body as { message?: unknown; network?: unknown };
      const network = parseNetwork((req.body as { network?: unknown }).network);

      if (!message || typeof message !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "Message is required and must be a string",
        });
      }

      const messageText = message;

      const metadata = sessionMetadata.get(id);

      if (!metadata) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (!metadata.topic) {
        return res.status(400).json({
          error: "Session not connected",
          message: "Wait for wallet approval first",
        });
      }

      try {
        // Send request asynchronously and store promise
        const requestPromise = wcClient.requestSignMessage(
          metadata.topic,
          { message: messageText },
          network,
        );

        const requestId = `req-${Date.now()}`;

        // Store promise for later retrieval
        metadata.responses.push({
          id: requestId,
          type: "signMessage",
          params: { message, network },
          promise: requestPromise,
          createdAt: Date.now(),
        });

        // Handle response in background
        requestPromise
          .then((result) => {
            console.log(`[API] Request ${requestId} completed:`, result);
          })
          .catch((error) => {
            console.error(`[API] Request ${requestId} failed:`, error);
          });

        // Don't wait for response here - client will poll /response endpoint
        return res.json({
          requestId,
          status: "pending",
          message: "Request sent. Poll /session/:id/response for result.",
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("[API] Failed to send signMessage request:", error);
        return res.status(500).json({
          error: "Failed to send request",
          message: errorMessage,
        });
      }
    },
  );

  /**
   * Send stellar_signXDR request
   * POST /session/:id/request/signXDR
   */
  router.post("/session/:id/request/signXDR", (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { xdr: xdrParam, description } = req.body as {
      xdr?: unknown;
      description?: string | number;
      network?: unknown;
    };
    const network = parseNetwork((req.body as { network?: unknown }).network);

    if (!xdrParam || typeof xdrParam !== "string") {
      return res.status(400).json({
        error: "Invalid request",
        message: "XDR is required and must be a string",
      });
    }

    const xdrText = xdrParam;
    const descriptionText =
      typeof description === "string" ? description : undefined;

    const metadata = sessionMetadata.get(id);

    if (!metadata) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (!metadata.topic) {
      return res.status(400).json({
        error: "Session not connected",
        message: "Wait for wallet approval first",
      });
    }

    try {
      const requestPromise = wcClient.requestSignXDR(
        metadata.topic,
        { xdr: xdrText, description: descriptionText },
        network,
      );

      const requestId = `req-${Date.now()}`;

      metadata.responses.push({
        id: requestId,
        type: "signXDR",
        params: { xdr: xdrText, description, network },
        promise: requestPromise,
        createdAt: Date.now(),
      });

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      requestPromise
        .then((result) => {
          console.log(`[API] Request ${requestId} completed:`, result);
        })
        .catch((error: unknown) => {
          console.error(`[API] Request ${requestId} failed:`, error);
        });

      return res.json({
        requestId,
        status: "pending",
        message: "Request sent. Poll /session/:id/response for result.",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[API] Failed to send signXDR request:", error);
      return res.status(500).json({
        error: "Failed to send request",
        message: errorMessage,
      });
    }
  });

  /**
   * Send stellar_signAuthEntry request
   * POST /session/:id/request/signAuthEntry
   *
   * Rate-limited to prevent DoS / brute-force abuse (CWE-307, CWE-770).
   * 30 req/min is well above any E2E test throughput.
   */
  const signAuthEntryRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.post(
    "/session/:id/request/signAuthEntry",
    signAuthEntryRateLimit,
    (req: Request, res: Response) => {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const { entryXdr } = req.body as {
        entryXdr?: unknown;
        network?: unknown;
      };
      const network = parseNetwork((req.body as { network?: unknown }).network);

      // Generate a fresh authorization entry if the caller didn't supply one.
      const entryXdrText =
        typeof entryXdr === "string" && entryXdr
          ? entryXdr
          : generateSorobanAuthEntryXdr();
      const metadata = sessionMetadata.get(id);

      if (!metadata) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (!metadata.topic) {
        return res.status(400).json({
          error: "Session not connected",
          message: "Wait for wallet approval first",
        });
      }

      try {
        const requestPromise = wcClient.requestSignAuthEntry(
          metadata.topic,
          { entryXdr: entryXdrText },
          network,
        );

        const requestId = `req-${Date.now()}`;

        metadata.responses.push({
          id: requestId,
          type: "signAuthEntry",
          params: { entryXdr: entryXdrText, network },
          promise: requestPromise,
          createdAt: Date.now(),
        });

        requestPromise
          .then((result) => {
            console.log(`[API] Request ${requestId} completed:`, result);
          })
          .catch((error: unknown) => {
            console.error(`[API] Request ${requestId} failed:`, error);
          });

        return res.json({
          requestId,
          status: "pending",
          message: "Request sent. Poll /session/:id/response for result.",
        });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("[API] Failed to send signAuthEntry request:", error);
        return res.status(500).json({
          error: "Failed to send request",
          message: errorMessage,
        });
      }
    },
  );

  /**
   * Get the latest response
   * GET /session/:id/response
   */
  router.get("/session/:id/response", async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const wait = req.query.wait === "true";
    const timeout = parseInt(req.query.timeout as string, 10) || 30000;

    const metadata = sessionMetadata.get(id);

    if (!metadata) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (metadata.responses.length === 0) {
      return res.json({
        status: "no_requests",
        message: "No requests sent yet",
      });
    }

    const lastRequest = metadata.responses[metadata.responses.length - 1];

    try {
      if (wait) {
        // Wait for response with timeout
        const result = await Promise.race([
          lastRequest.promise,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Timeout")), timeout);
          }),
        ]);

        return res.json({
          requestId: lastRequest.id,
          type: lastRequest.type,
          status: "approved",
          result,
        });
      }
      // Try to get result immediately
      const isResolved = await Promise.race([
        lastRequest.promise.then(() => true),
        new Promise((resolve) => {
          setTimeout(() => resolve(false), 100);
        }),
      ]);

      if (isResolved) {
        const result = await lastRequest.promise;
        return res.json({
          requestId: lastRequest.id,
          type: lastRequest.type,
          status: "approved",
          result,
        });
      }
      return res.json({
        requestId: lastRequest.id,
        type: lastRequest.type,
        status: "pending",
        message: "Request still pending. Use ?wait=true to wait for response.",
      });
    } catch (error: unknown) {
      // Check if it's a rejection from wallet
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage?.includes("User rejected")) {
        return res.json({
          requestId: lastRequest.id,
          type: lastRequest.type,
          status: "rejected",
          error: errorMessage,
        });
      }
      return res.status(500).json({
        requestId: lastRequest.id,
        type: lastRequest.type,
        status: "error",
        error: errorMessage,
      });
    }
  });

  /**
   * Disconnect a session
   * DELETE /session/:id
   */
  router.delete("/session/:id", async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const metadata = sessionMetadata.get(id);

    if (!metadata) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (metadata.topic) {
      try {
        await wcClient.disconnectSession(metadata.topic);
      } catch (error: unknown) {
        console.error("[API] Failed to disconnect session:", error);
      }
    }

    sessionMetadata.delete(id);

    return res.json({
      sessionId: id,
      message: "Session disconnected",
    });
  });

  /**
   * List all active sessions
   * GET /sessions
   */
  router.get("/sessions", (_req: Request, res: Response) => {
    const sessions = Array.from(sessionMetadata.values()).map((metadata) => {
      const session = metadata.topic
        ? wcClient.getSession(metadata.topic)
        : null;

      return {
        sessionId: metadata.sessionId,
        topic: metadata.topic || null,
        connected: !!session,
        createdAt: metadata.createdAt,
        requestCount: metadata.responses.length,
      };
    });

    res.json({ sessions });
  });

  /**
   * Disconnect all sessions
   * DELETE /sessions
   */
  router.delete("/sessions", async (_req: Request, res: Response) => {
    try {
      await wcClient.disconnectAll();
      sessionMetadata.clear();

      return res.json({
        message: "All sessions disconnected",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[API] Failed to disconnect all sessions:", error);
      return res.status(500).json({
        error: "Failed to disconnect sessions",
        message: errorMessage,
      });
    }
  });

  return router;
}
