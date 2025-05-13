import { Federation } from "@stellar/stellar-sdk";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { getActiveAccountPublicKey, useAuthenticationStore } from "ducks/auth";
import {
  isFederationAddress,
  isSameAccount,
  isValidStellarAddress,
} from "helpers/stellar";
import { getAccount } from "services/stellar";
import { dataStorage } from "services/storage/storageFactory";
import { create } from "zustand";

interface Contact {
  id: string;
  address: string;
  name?: string;
}

interface SendStore {
  recentAddresses: Contact[];
  searchResults: Contact[];
  destinationAddress: string;
  federationAddress: string;
  isSearching: boolean;
  searchError: string | null;
  isValidDestination: boolean;
  isDestinationFunded: boolean | null;

  loadRecentAddresses: () => Promise<void>;
  addRecentAddress: (address: string, name?: string) => Promise<void>;
  searchAddress: (searchTerm: string) => Promise<void>;
  setDestinationAddress: (address: string, fedAddress?: string) => void;
  resetSendRecipient: () => void;
}

const initialState: Omit<
  SendStore,
  | "loadRecentAddresses"
  | "addRecentAddress"
  | "searchAddress"
  | "setDestinationAddress"
  | "resetSendRecipient"
> = {
  recentAddresses: [],
  searchResults: [],
  destinationAddress: "",
  federationAddress: "",
  isSearching: false,
  searchError: null,
  isValidDestination: false,
  isDestinationFunded: null,
};

export const useSendRecipientStore = create<SendStore>((set, get) => ({
  ...initialState,

  loadRecentAddresses: async () => {
    try {
      const storedAddresses = await dataStorage.getItem(
        STORAGE_KEYS.RECENT_ADDRESSES,
      );
      const parsedAddresses: string[] = storedAddresses
        ? JSON.parse(storedAddresses)
        : [];

      // Get current active account public key
      const activePublicKey = await getActiveAccountPublicKey();

      // Transform to the Contact format, filtering out the current account
      const contactList: Contact[] = parsedAddresses
        .filter(
          (address) =>
            !activePublicKey || !isSameAccount(address, activePublicKey),
        )
        .map((address: string, index: number) => ({
          id: `recent-${index}`,
          address,
        }));

      set({ recentAddresses: contactList });
    } catch (error) {
      logger.error("Failed to load recent addresses:", String(error));
      set({ recentAddresses: [] });
    }
  },

  addRecentAddress: async (address: string, name?: string) => {
    try {
      const { recentAddresses } = get();

      const exists = recentAddresses.some(
        (contact) => contact.address === address,
      );

      if (!exists) {
        const newContact = { id: `recent-${Date.now()}`, address, name };
        const updatedAddresses = [newContact, ...recentAddresses];

        const limitedAddresses = updatedAddresses.slice(0, 10);

        set({ recentAddresses: limitedAddresses });

        const addressesOnly = limitedAddresses.map(
          (contact) => contact.address,
        );
        await dataStorage.setItem(
          STORAGE_KEYS.RECENT_ADDRESSES,
          JSON.stringify(addressesOnly),
        );
      }
    } catch (error) {
      logger.error("Failed to add recent address:", String(error));
    }
  },

  searchAddress: async (searchTerm: string) => {
    set({
      isSearching: true,
      searchError: null,
      isValidDestination: false,
      isDestinationFunded: null,
      searchResults: [],
    });

    try {
      const { network } = useAuthenticationStore.getState();

      if (!searchTerm) {
        set({ isSearching: false });
        return;
      }

      // Get current active account public key
      const activePublicKey = await getActiveAccountPublicKey();

      const isSyntacticallyValid = isValidStellarAddress(searchTerm);

      if (!isSyntacticallyValid) {
        set({
          isSearching: false,
          searchError: "Invalid Stellar address format",
        });
        return;
      }

      if (activePublicKey && isSameAccount(searchTerm, activePublicKey)) {
        set({
          isSearching: false,
          isValidDestination: false,
          searchError: "Cannot send to yourself",
        });
        return;
      }

      let resolvedAddress = searchTerm;
      let fedAddress = "";
      let isFunded: boolean | null = null;

      if (isFederationAddress(searchTerm)) {
        try {
          const fedRecord = await Federation.Server.resolve(searchTerm);
          resolvedAddress = fedRecord.account_id;
          fedAddress = searchTerm;

          // Re-check if resolved address is the user's own account
          if (
            activePublicKey &&
            isSameAccount(resolvedAddress, activePublicKey)
          ) {
            set({
              isSearching: false,
              isValidDestination: false,
              searchError:
                "Cannot send to yourself (resolved federation address)",
            });
            return;
          }
        } catch (error) {
          logger.error("Federation resolution failed:", String(error));
          set({
            isSearching: false,
            searchError: "Federation address not found or resolution failed",
          });
          return;
        }
      }

      try {
        const account = await getAccount(resolvedAddress, network);
        isFunded = !!account;
      } catch (error: unknown) {
        let isNotFoundError = false;

        if (
          typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof error.response === "object" &&
          error.response !== null &&
          "status" in error.response &&
          (error.response as { status: number }).status === 404
        ) {
          isNotFoundError = true;
        }

        if (isNotFoundError) {
          isFunded = false;
        } else {
          logger.error("Account lookup failed:", String(error));
          set({
            isSearching: false,
            searchError: "Failed to check destination account status",
          });
          return;
        }
      }

      const result: Contact = {
        id: `search-${Date.now()}`,
        address: searchTerm,
      };

      set({
        searchResults: [result],
        isValidDestination: true,
        isDestinationFunded: isFunded,
        destinationAddress: resolvedAddress,
        federationAddress: fedAddress,
        isSearching: false,
        searchError: null,
      });
    } catch (error) {
      logger.error("Error searching for address:", String(error));
      set({
        isSearching: false,
        searchError: "An unexpected error occurred during search",
        isValidDestination: false,
        isDestinationFunded: null,
      });
    }
  },

  setDestinationAddress: (address: string, fedAddress?: string) => {
    set({
      destinationAddress: address,
      federationAddress: fedAddress || "",
      isValidDestination: true,
      isDestinationFunded: null,
    });
  },

  resetSendRecipient: () => {
    set({
      ...initialState,
    });
  },
}));
