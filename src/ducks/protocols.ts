/**
 * Protocols Store Module
 * @fileoverview Zustand store for managing discovered protocols state
 *
 * This module provides centralized state management for protocols data,
 * including fetching, caching, and error handling.
 */
import { DiscoverProtocol } from "config/types";
import { fetchProtocols } from "services/backend";
import { create } from "zustand";

/**
 * State interface for the protocols store
 * @interface ProtocolsState
 * @property {DiscoverProtocol[]} protocols - Array of discovered protocols
 * @property {boolean} isLoading - Loading state indicator
 * @property {number | null} lastUpdated - Timestamp of last successful fetch (null if never fetched)
 * @property {() => Promise<void>} fetchProtocols - Function to fetch protocols from backend
 */
interface ProtocolsState {
  protocols: DiscoverProtocol[];
  isLoading: boolean;
  lastUpdated: number | null;
  fetchProtocols: () => Promise<void>;
}

/**
 * Protocols Store
 * @function useProtocolsStore
 * @description
 * A Zustand store that manages the state of protocols in the application.
 * Provides centralized state management for discovered protocols with:
 * - Loading state management
 * - Error handling with data preservation
 * - Timestamp tracking for cache invalidation
 * - Automatic filtering of blacklisted/unsupported protocols
 *
 * @returns {ProtocolsState} The protocols store state and actions
 *
 * @note
 * - On successful fetch: Updates protocols array and lastUpdated timestamp
 * - On error: Preserves existing protocols and only resets loading state
 * - Loading state is managed automatically during fetch operations
 *
 * @example
 * ```tsx
 * const { protocols, isLoading, fetchProtocols } = useProtocolsStore();
 *
 * useEffect(() => {
 *   fetchProtocols();
 * }, []);
 * ```
 */
export const useProtocolsStore = create<ProtocolsState>((set) => ({
  protocols: [],
  isLoading: false,
  lastUpdated: null,

  /**
   * Fetches protocols from the backend and updates the store
   * @async
   * @description
   * Fetches protocols from the backend API and updates the store state.
   * Handles loading states and error scenarios gracefully.
   *
   * - Sets loading state to true during fetch
   * - Updates protocols array with fetched data
   * - Updates lastUpdated timestamp on success
   * - Preserves existing protocols on error
   * - Sets loading state to false on completion
   *
   * @throws {Error} When the backend API call fails
   */
  fetchProtocols: async () => {
    try {
      set({ isLoading: true });

      const protocols = await fetchProtocols();

      set({
        protocols,
        isLoading: false,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      // In case of error, let's keep the current protocols list we have in store
      set({ isLoading: false });
    }
  },
}));
