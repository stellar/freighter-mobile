/* eslint-disable no-console */
import SignClient from "@walletconnect/sign-client";
import { SessionTypes } from "@walletconnect/types";

export interface WalletConnectSession {
  topic: string;
  peer: {
    metadata: SessionTypes.Struct["peer"]["metadata"];
  };
  namespaces: SessionTypes.Struct["namespaces"];
  expiry: number;
}

export interface SignMessageParams {
  message: string;
}

export interface SignXdrParams {
  xdr: string;
  description?: string;
}

export interface SignMessageResponse {
  signature: string;
  signer: string;
}

export interface SignXdrResponse {
  signedXDR: string;
  signer: string;
}

/**
 * WalletConnect client wrapper for mock dApp
 */
export class MockWalletConnectClient {
  private client: SignClient | null = null;

  private sessions: Map<string, SessionTypes.Struct> = new Map();

  constructor(private projectId: string) {}

  /**
   * Initialize WalletConnect SignClient
   */
  async initialize(): Promise<void> {
    this.client = await SignClient.init({
      projectId: this.projectId,
      metadata: {
        name: "Mock WalletConnect dApp",
        description: "E2E testing mock dApp for Freighter Mobile",
        url: "http://localhost:3001",
        icons: ["https://docs.freighter.app/images/logo.png"],
      },
    });

    // Set up event listeners
    this.client.on("session_delete", ({ topic }) => {
      console.log(`[WC] Session deleted: ${topic}`);
      this.sessions.delete(topic);
    });

    this.client.on("session_expire", ({ topic }) => {
      console.log(`[WC] Session expired: ${topic}`);
      this.sessions.delete(topic);
    });

    console.log("[WC] SignClient initialized successfully");
  }

  /**
   * Create a new WalletConnect session
   * Returns URI for QR code or deep link
   */
  async createSession(): Promise<{
    uri: string;
    approval: () => Promise<SessionTypes.Struct>;
  }> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    const { uri, approval } = await this.client.connect({
      requiredNamespaces: {
        stellar: {
          methods: [
            "stellar_signMessage",
            "stellar_signXDR",
            "stellar_signAndSubmitXDR",
          ],
          chains: ["stellar:testnet", "stellar:pubnet"],
          events: ["accountsChanged"],
        },
      },
    });

    if (!uri) {
      throw new Error("Failed to generate WalletConnect URI");
    }

    // Wrap approval to store session when it completes
    const wrappedApproval = async () => {
      const session = await approval();
      this.sessions.set(session.topic, session);
      console.log(`[WC] Session approved and stored: ${session.topic}`);
      return session;
    };

    return { uri, approval: wrappedApproval };
  }

  /**
   * Send stellar_signMessage request
   */
  async requestSignMessage(
    topic: string,
    params: SignMessageParams,
    network: "testnet" | "pubnet" = "testnet",
  ): Promise<SignMessageResponse> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    const session = this.sessions.get(topic);
    if (!session) {
      throw new Error(`Session not found: ${topic}`);
    }

    const chainId = `stellar:${network}`;

    console.log(`[WC] Requesting stellar_signMessage on ${chainId}:`, {
      message: `${params.message.substring(0, 50)}...`,
      length: params.message.length,
    });

    const result = await this.client.request({
      topic,
      chainId,
      request: {
        method: "stellar_signMessage",
        params,
      },
    });

    console.log("[WC] stellar_signMessage response received");
    return result as SignMessageResponse;
  }

  /**
   * Send stellar_signXDR request
   */
  async requestSignXDR(
    topic: string,
    params: SignXdrParams,
    network: "testnet" | "pubnet" = "testnet",
  ): Promise<SignXdrResponse> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    const session = this.sessions.get(topic);
    if (!session) {
      throw new Error(`Session not found: ${topic}`);
    }

    const chainId = `stellar:${network}`;

    console.log(`[WC] Requesting stellar_signXDR on ${chainId}`);

    const result = await this.client.request({
      topic,
      chainId,
      request: {
        method: "stellar_signXDR",
        params,
      },
    });

    console.log("[WC] stellar_signXDR response received");
    return result as SignXdrResponse;
  }

  /**
   * Send stellar_signAndSubmitXDR request
   */
  async requestSignAndSubmitXDR(
    topic: string,
    params: SignXdrParams,
    network: "testnet" | "pubnet" = "testnet",
  ): Promise<{ hash: string }> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    const session = this.sessions.get(topic);
    if (!session) {
      throw new Error(`Session not found: ${topic}`);
    }

    const chainId = `stellar:${network}`;

    console.log(`[WC] Requesting stellar_signAndSubmitXDR on ${chainId}`);

    const result = await this.client.request({
      topic,
      chainId,
      request: {
        method: "stellar_signAndSubmitXDR",
        params,
      },
    });

    console.log("[WC] stellar_signAndSubmitXDR response received");
    return result as { hash: string };
  }

  /**
   * Disconnect a session
   */
  async disconnectSession(topic: string): Promise<void> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    await this.client.disconnect({
      topic,
      reason: {
        code: 6000,
        message: "User disconnected",
      },
    });

    this.sessions.delete(topic);
    console.log(`[WC] Session disconnected: ${topic}`);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): WalletConnectSession[] {
    return Array.from(this.sessions.values()).map((session) => ({
      topic: session.topic,
      peer: {
        metadata: session.peer.metadata,
      },
      namespaces: session.namespaces,
      expiry: session.expiry,
    }));
  }

  /**
   * Get session by topic
   */
  getSession(topic: string): WalletConnectSession | undefined {
    const session = this.sessions.get(topic);
    if (!session) return undefined;

    return {
      topic: session.topic,
      peer: {
        metadata: session.peer.metadata,
      },
      namespaces: session.namespaces,
      expiry: session.expiry,
    };
  }

  /**
   * Disconnect all sessions
   */
  async disconnectAll(): Promise<void> {
    const topics = Array.from(this.sessions.keys());
    await Promise.all(topics.map((topic) => this.disconnectSession(topic)));
    console.log("[WC] All sessions disconnected");
  }
}
