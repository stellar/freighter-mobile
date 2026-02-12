/* eslint-disable @fnando/consistent-import/consistent-import */
import { Router, Request, Response } from "express";

import { MockWalletConnectClient } from "./walletconnect";

export function createRoutes(wcClient: MockWalletConnectClient): Router {
  const router = Router();

  // Store session metadata
  interface SessionResponse {
    id: string;
    type: "signMessage" | "signXDR";
    params: Record<string, string | number>;
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

      res.json({
        sessionId,
        uri,
        deepLink,
        message: "Session created. Use URI or deepLink to connect wallet.",
      });
      console.log("[API] 📤 Response sent:", {
        sessionId,
        deepLink: `${deepLink.substring(0, 50)}...`,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[API] Failed to create session:", error);
      res.status(500).json({
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

    res.json({
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

      await new Promise((resolve) => setTimeout(resolve, 500));
      return checkApproval();
    };

    try {
      await checkApproval();

      const session = wcClient.getSession(metadata.topic);

      res.json({
        sessionId: metadata.sessionId,
        topic: metadata.topic,
        connected: true,
        session,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      res.status(408).json({
        error: "Timeout",
        message: errorMessage,
      });
    }
  });

  /**
   * Send stellar_signMessage request
   * POST /session/:id/request/signMessage
   */
  router.post(
    "/session/:id/request/signMessage",
    async (req: Request, res: Response) => {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const { message, network = "testnet" } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "Message is required and must be a string",
        });
      }

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
          { message },
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

        // Don't wait for response here - client will poll /response endpoint
        res.json({
          requestId,
          status: "pending",
          message: "Request sent. Poll /session/:id/response for result.",
        });

        // Handle response in background
        requestPromise
          .then((result) => {
            console.log(`[API] Request ${requestId} completed:`, result);
          })
          .catch((error) => {
            console.error(`[API] Request ${requestId} failed:`, error);
          });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("[API] Failed to send signMessage request:", error);
        res.status(500).json({
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
  router.post(
    "/session/:id/request/signXDR",
    async (req: Request, res: Response) => {
      const id = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const { xdr, description, network = "testnet" } = req.body;

      if (!xdr || typeof xdr !== "string") {
        return res.status(400).json({
          error: "Invalid request",
          message: "XDR is required and must be a string",
        });
      }

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
          { xdr, description },
          network,
        );

        const requestId = `req-${Date.now()}`;

        metadata.responses.push({
          id: requestId,
          type: "signXDR",
          params: { xdr, description, network },
          promise: requestPromise,
          createdAt: Date.now(),
        });

        res.json({
          requestId,
          status: "pending",
          message: "Request sent. Poll /session/:id/response for result.",
        });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        requestPromise
          .then((result) => {
            console.log(`[API] Request ${requestId} completed:`, result);
          })
          .catch((error: unknown) => {
            console.error(`[API] Request ${requestId} failed:`, error);
          });
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("[API] Failed to send signXDR request:", error);
        res.status(500).json({
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
    const timeout = parseInt(req.query.timeout as string) || 30000;

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
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), timeout),
          ),
        ]);

        res.json({
          requestId: lastRequest.id,
          type: lastRequest.type,
          status: "approved",
          result,
        });
      } else {
        // Try to get result immediately
        const isResolved = await Promise.race([
          lastRequest.promise.then(() => true),
          new Promise((resolve) => setTimeout(() => resolve(false), 100)),
        ]);

        if (isResolved) {
          const result = await lastRequest.promise;
          res.json({
            requestId: lastRequest.id,
            type: lastRequest.type,
            status: "approved",
            result,
          });
        } else {
          res.json({
            requestId: lastRequest.id,
            type: lastRequest.type,
            status: "pending",
            message:
              "Request still pending. Use ?wait=true to wait for response.",
          });
        }
      }
    } catch (error: unknown) {
      // Check if it's a rejection from wallet
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (errorMessage?.includes("User rejected")) {
        res.json({
          requestId: lastRequest.id,
          type: lastRequest.type,
          status: "rejected",
          error: errorMessage,
        });
      } else {
        res.status(500).json({
          requestId: lastRequest.id,
          type: lastRequest.type,
          status: "error",
          error: errorMessage,
        });
      }
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

    res.json({
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

      res.json({
        message: "All sessions disconnected",
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("[API] Failed to disconnect all sessions:", error);
      res.status(500).json({
        error: "Failed to disconnect sessions",
        message: errorMessage,
      });
    }
  });

  return router;
}
