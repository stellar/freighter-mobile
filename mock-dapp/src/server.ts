/* eslint-disable @fnando/consistent-import/consistent-import */
/* eslint-disable no-console */
import cors from "cors";
import dotenv from "dotenv";
import express, { Application } from "express";
import path from "path";

import { createRoutes } from "./routes";
import { MockWalletConnectClient } from "./walletconnect";

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || "3001", 10);
const HOST = process.env.HOST || "127.0.0.1";
const PROJECT_ID = process.env.WALLET_KIT_PROJECT_ID;

if (!PROJECT_ID) {
  console.error("❌ WALLET_KIT_PROJECT_ID is required");
  console.error("   Create .env file from .env.example and set the project ID");
  process.exit(1);
}

/**
 * Initialize and start the mock WalletConnect dApp server
 */
async function startServer(): Promise<void> {
  console.log("🚀 Starting Mock WalletConnect dApp Server...\n");

  // Initialize WalletConnect client
  console.log("[1/3] Initializing WalletConnect SignClient...");
  const wcClient = new MockWalletConnectClient(PROJECT_ID!);
  await wcClient.initialize();
  console.log("✅ WalletConnect SignClient ready\n");

  // Create Express app
  console.log("[2/3] Setting up Express server...");
  const app: Application = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(
    (
      req: express.Request,
      _res: express.Response,
      next: express.NextFunction,
    ) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${req.method} ${req.path}`);
      next();
    },
  );

  // Serve static files from public directory
  const publicPath = path.join(__dirname, "..", "public");
  app.use(express.static(publicPath));

  // Routes
  const router = createRoutes(wcClient);
  app.use("/", router);

  // Error handling
  app.use((err: Error, _req: express.Request, res: express.Response) => {
    console.error("❌ Unhandled error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  });

  console.log("✅ Express routes configured\n");

  // Start server
  console.log("[3/3] Starting HTTP server...");
  const server = app.listen(PORT, HOST, () => {
    console.log("✅ Server started successfully\n");
    console.log("━".repeat(60));
    console.log("🌐 Mock WalletConnect dApp Server");
    console.log("━".repeat(60));
    console.log(`📍 URL:        http://${HOST}:${PORT}`);
    console.log(`🔌 Project ID: ${PROJECT_ID!.substring(0, 12)}...`);
    console.log(
      `📱 App Scheme: ${process.env.MOBILE_APP_SCHEME || "freighterdev"}`,
    );
    console.log("━".repeat(60));
    console.log("\n📚 API Endpoints:");
    console.log(
      "   GET    /health                              - Health check",
    );
    console.log(
      "   POST   /session/create                      - Create new session",
    );
    console.log(
      "   GET    /session/:id                         - Get session status",
    );
    console.log(
      "   GET    /session/:id/wait                    - Wait for approval",
    );
    console.log(
      "   POST   /session/:id/request/signMessage     - Send signMessage request",
    );
    console.log(
      "   POST   /session/:id/request/signXDR         - Send signXDR request",
    );
    console.log(
      "   GET    /session/:id/response                - Get latest response",
    );
    console.log(
      "   DELETE /session/:id                         - Disconnect session",
    );
    console.log(
      "   GET    /sessions                            - List all sessions",
    );
    console.log(
      "   DELETE /sessions                            - Disconnect all",
    );
    console.log("\n💡 Usage:");
    console.log("   1. POST to /session/create");
    console.log("   2. Use deepLink in Maestro: openLink");
    console.log("   3. POST to /session/:id/request/signMessage");
    console.log("   4. GET /session/:id/response?wait=true");
    console.log("\n✨ Ready for E2E testing!\n");
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down gracefully...");

    server.close(() => {
      console.log("✅ HTTP server closed");
    });

    try {
      await wcClient.disconnectAll();
      console.log("✅ All WalletConnect sessions disconnected");
    } catch (error) {
      console.error("⚠️  Error disconnecting sessions:", error);
    }

    console.log("👋 Goodbye!\n");
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    console.log("Received SIGTERM signal");
    shutdown();
  });
  process.on("SIGINT", () => {
    console.log("Received SIGINT signal");
    shutdown();
  });
}

// Start the server
startServer().catch((error) => {
  console.error("❌ Fatal error starting server:", error);
  process.exit(1);
});
