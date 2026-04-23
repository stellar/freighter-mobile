import { Federation, StrKey } from "@stellar/stellar-sdk";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { getActiveAccountPublicKey, useAuthenticationStore } from "ducks/auth";
import {
  isFederationAddress,
  isSameAccount,
  isValidStellarAddress,
} from "helpers/stellar";
import { t } from "i18next";
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
  federationMemo: string;
  federationMemoType: string;
  isSearching: boolean;
  searchError: string | null;
  isValidDestination: boolean;
  isDestinationFunded: boolean | null;

  loadRecentAddresses: () => Promise<void>;
  addRecentAddress: (address: string, name?: string) => Promise<void>;
  searchAddress: (searchTerm: string) => Promise<void>;
  setDestinationAddress: (address: string, fedAddress?: string) => void;
  clearSearchState: () => void;
  resetSendRecipient: () => void;
}

const initialState: Omit<
  SendStore,
  | "loadRecentAddresses"
  | "addRecentAddress"
  | "searchAddress"
  | "setDestinationAddress"
  | "clearSearchState"
  | "resetSendRecipient"
> = {
  recentAddresses: [],
  searchResults: [],
  destinationAddress: "",
  federationAddress: "",
  federationMemo: "",
  federationMemoType: "",
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
      const parsedData: (string | { address: string; name?: string })[] =
        storedAddresses ? JSON.parse(storedAddresses) : [];

      // Get current active account public key
      const activePublicKey = await getActiveAccountPublicKey();

      // Transform to the Contact format, filtering out the current account
      // Supports both old format (string[]) and new format ({address, name}[])
      const contactList: Contact[] = parsedData
        .map((entry, index: number) => {
          const addr = typeof entry === "string" ? entry : entry.address;
          const name = typeof entry === "string" ? undefined : entry.name;
          return { id: `recent-${index}`, address: addr, name };
        })
        .filter(
          (contact) =>
            !activePublicKey ||
            !isSameAccount(contact.address, activePublicKey),
        );

      set({ recentAddresses: contactList });
    } catch (error) {
      logger.error(
        "[sendRecipient]",
        "Failed to load recent addresses:",
        error,
      );

      set({ recentAddresses: [] });
    }
  },

  addRecentAddress: async (address: string, name?: string) => {
    try {
      const { recentAddresses } = get();

      const existingIndex = recentAddresses.findIndex(
        (contact) => contact.address === address,
      );

      let updatedAddresses: Contact[];

      if (existingIndex === -1) {
        const newContact = { id: `recent-${Date.now()}`, address, name };
        updatedAddresses = [newContact, ...recentAddresses];
      } else if (name && recentAddresses[existingIndex].name !== name) {
        // Update the federation name if it has changed or was previously missing
        const updated = { ...recentAddresses[existingIndex], name };
        updatedAddresses = [
          updated,
          ...recentAddresses.filter((_, i) => i !== existingIndex),
        ];
      } else {
        return;
      }

      set({ recentAddresses: updatedAddresses });

      const addressData = updatedAddresses.map((contact) => ({
        address: contact.address,
        ...(contact.name ? { name: contact.name } : {}),
      }));
      await dataStorage.setItem(
        STORAGE_KEYS.RECENT_ADDRESSES,
        JSON.stringify(addressData),
      );
    } catch (error) {
      logger.error("[sendRecipient]", "Failed to add recent address:", error);
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
          searchError: t("sendRecipient.error.invalidAddressFormat"),
        });
        return;
      }

      if (activePublicKey && isSameAccount(searchTerm, activePublicKey)) {
        set({
          isSearching: false,
          isValidDestination: false,
          searchError: t("sendRecipient.error.sendToSelf"),
        });
        return;
      }

      let resolvedAddress = searchTerm;
      let fedAddress = "";
      let fedMemo = "";
      let fedMemoType = "";
      let isFunded: boolean | null = null;

      if (isFederationAddress(searchTerm)) {
        try {
          const fedRecord = await Federation.Server.resolve(searchTerm, {
            timeout: 10000,
          });

          if (!StrKey.isValidEd25519PublicKey(fedRecord.account_id)) {
            set({
              isSearching: false,
              searchError: t("sendRecipient.error.federationNotFound"),
            });
            return;
          }

          resolvedAddress = fedRecord.account_id;
          fedAddress = searchTerm;
          fedMemo = fedRecord.memo ?? "";
          fedMemoType = fedRecord.memo_type ?? "";

          // Re-check if resolved address is the user's own account
          if (
            activePublicKey &&
            isSameAccount(resolvedAddress, activePublicKey)
          ) {
            set({
              isSearching: false,
              isValidDestination: false,
              searchError: t("sendRecipient.error.sendToSelfFederation"),
            });
            return;
          }
        } catch (error) {
          logger.error(
            "[sendRecipient]",
            "Federation resolution failed:",
            error,
          );

          set({
            isSearching: false,
            searchError: t("sendRecipient.error.federationNotFound"),
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
          logger.error("[sendRecipient]", "Account lookup failed:", error);

          set({
            isSearching: false,
            searchError: t("sendRecipient.error.destinationAccountStatus"),
          });

          return;
        }
      }

      const result: Contact = {
        id: `search-${Date.now()}`,
        address: resolvedAddress,
        name: fedAddress || undefined,
      };

      set({
        searchResults: [result],
        isValidDestination: true,
        isDestinationFunded: isFunded,
        destinationAddress: resolvedAddress,
        federationAddress: fedAddress,
        federationMemo: fedMemo,
        federationMemoType: fedMemoType,
        isSearching: false,
        searchError: null,
      });
    } catch (error) {
      logger.error("[sendRecipient]", "Error searching for address:", error);

      set({
        isSearching: false,
        searchError: t("sendRecipient.error.unexpectedSearchError"),
        isValidDestination: false,
        isDestinationFunded: null,
      });
    }
  },

  setDestinationAddress: (address: string, fedAddress?: string) => {
    const { network } = useAuthenticationStore.getState();

    set({
      destinationAddress: address,
      federationAddress: fedAddress || "",
      isValidDestination: true,
      isDestinationFunded: null, // Will be updated async
    });

    // Fetch the account funding status asynchronously
    (async () => {
      try {
        const account = await getAccount(address, network);
        set({
          isDestinationFunded: !!account,
        });
      } catch (error) {
        logger.error(
          "[sendRecipient]",
          "Failed to check account status:",
          error,
        );

        // If account lookup returns 404, mark as unfunded so we can surface
        // the expected-to-fail banner; otherwise leave unknown (null).
        const isNotFound =
          typeof error === "object" &&
          error !== null &&
          "response" in error &&
          (error as { response?: { status?: number } }).response?.status ===
            404;

        set({
          isDestinationFunded: isNotFound ? false : null,
        });
      }
    })();
  },

  clearSearchState: () => {
    set({
      searchResults: [],
      searchError: null,
      isValidDestination: false,
      isDestinationFunded: null,
      isSearching: true,
    });
  },

  resetSendRecipient: () => {
    set({
      ...initialState,
    });
  },
}));
