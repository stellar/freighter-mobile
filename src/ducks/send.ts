import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { getActiveAccountPublicKey } from "ducks/auth";
import { isValidStellarAddress, isSameAccount } from "helpers/stellar";
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

  loadRecentAddresses: () => Promise<void>;
  addRecentAddress: (address: string, name?: string) => Promise<void>;
  searchAddress: (searchTerm: string) => Promise<void>;
  setDestinationAddress: (address: string, fedAddress?: string) => void;
  reset: () => void;
}

export const useSendStore = create<SendStore>((set, get) => ({
  recentAddresses: [],
  searchResults: [],
  destinationAddress: "",
  federationAddress: "",
  isSearching: false,
  searchError: null,
  isValidDestination: false,

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
    set({ isSearching: true, searchError: null });

    try {
      if (!searchTerm) {
        set({
          searchResults: [],
          isSearching: false,
          isValidDestination: false,
        });
        return;
      }

      // Get current active account public key
      const activePublicKey = await getActiveAccountPublicKey();

      // If search term is the same as current account, show an error
      if (
        activePublicKey &&
        isValidStellarAddress(searchTerm) &&
        isSameAccount(searchTerm, activePublicKey)
      ) {
        set({
          searchResults: [],
          isValidDestination: false,
          isSearching: false,
          searchError: "Cannot send to yourself",
        });
        return;
      }

      const isValid = isValidStellarAddress(searchTerm);

      if (isValid) {
        const result: Contact = {
          id: `search-${Date.now()}`,
          address: searchTerm,
        };

        set({
          searchResults: [result],
          isValidDestination: true,
          isSearching: false,
        });
      } else {
        set({
          searchResults: [],
          isValidDestination: false,
          isSearching: false,
          searchError: "Invalid Stellar address",
        });
      }
    } catch (error) {
      logger.error("Error searching for address:", String(error));

      set({
        isSearching: false,
        searchError: "Error searching for address",
        isValidDestination: false,
      });
    }
  },

  setDestinationAddress: (address: string, fedAddress?: string) => {
    set({
      destinationAddress: address,
      federationAddress: fedAddress || "",
    });
  },

  reset: () => {
    set({
      searchResults: [],
      destinationAddress: "",
      federationAddress: "",
      isSearching: false,
      searchError: null,
      isValidDestination: false,
    });
  },
}));
