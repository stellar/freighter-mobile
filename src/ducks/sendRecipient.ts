import { Federation as StellarFederation, StrKey } from "@stellar/stellar-sdk";
import { STORAGE_KEYS } from "config/constants";
import { logger } from "config/logger";
import { getActiveAccountPublicKey, useAuthenticationStore } from "ducks/auth";
import { isContractDestination } from "helpers/muxedContract";
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
  prepareForSearch: () => void;
  resetSendRecipient: () => void;
}

// Shared search state reset fields used by both prepareForSearch and searchAddress.
// Extracted here so both paths stay in sync if fields are added or renamed.
const SEARCH_RESET_STATE = {
  searchResults: [] as Contact[],
  searchError: null as string | null,
  isValidDestination: false,
  isDestinationFunded: null as boolean | null,
  isSearching: true,
  destinationAddress: "",
  federationAddress: "",
  federationMemo: "",
  federationMemoType: "",
};

const initialState: Omit<
  SendStore,
  | "loadRecentAddresses"
  | "addRecentAddress"
  | "searchAddress"
  | "setDestinationAddress"
  | "prepareForSearch"
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
      // Supports both old format (string[]) and new format ({address, name?}[])
      const contactList: Contact[] = parsedData
        .map((entry, index: number) => {
          const addr = typeof entry === "string" ? entry : entry.address;
          const name = typeof entry === "string" ? undefined : entry.name;
          return {
            id: `recent-${index}`,
            address: addr,
            name,
          } as Contact;
        })
        .filter(
          (contact) =>
            typeof contact.address === "string" &&
            contact.address.length > 0 &&
            (!activePublicKey ||
              !isSameAccount(contact.address, activePublicKey)),
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

      // Normalize federation address to lowercase (SEP-0002: case-insensitive)
      const normalizedName = name?.toLowerCase();

      const existingIndex = recentAddresses.findIndex(
        (contact) => contact.address === address,
      );

      let updatedAddresses: Contact[];

      if (existingIndex === -1) {
        updatedAddresses = [
          {
            id: `recent-${Date.now()}`,
            address,
            name: normalizedName,
          },
          ...recentAddresses,
        ];
      } else {
        const existing = recentAddresses[existingIndex];
        if (existing.name === normalizedName) {
          return;
        }
        updatedAddresses = [
          { ...existing, name: normalizedName },
          ...recentAddresses.filter((_, i) => i !== existingIndex),
        ];
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

  /**
   * Validates a typed or pasted recipient (an address or a federation
   * address), resolves a federation address to its account, and stores the
   * result together with whether the destination is funded.
   *
   * A contract destination (`C…` or `W…`) holds no classic account, so it
   * gets no account lookup and is recorded as unfunded
   * (`isDestinationFunded: false`), the value a `C…` already got because
   * looking up a contract address finds no account. Any other destination
   * is looked up to learn whether its account exists.
   *
   * @param searchTerm The address or federation address to search for
   */
  searchAddress: async (searchTerm: string) => {
    set(SEARCH_RESET_STATE);

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
          const fedRecord = await StellarFederation.Server.resolve(searchTerm, {
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
          // Normalize to lowercase per SEP-0002 (federation addresses are case-insensitive)
          fedAddress = searchTerm.toLowerCase();
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
        if (isContractDestination(resolvedAddress)) {
          // No classic account to look up: a contract's balances live in its
          // own storage. Same value the lookup of a `C…` yielded (no account).
          isFunded = false;
        } else {
          const account = await getAccount(resolvedAddress, network);
          isFunded = !!account;
        }
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

  /**
   * Sets the destination the user picked in the contact list (a search
   * suggestion, a recent, or one of their own wallets) and refreshes its
   * funding status in the background.
   *
   * A contract destination (`C…` or `W…`) holds no classic account, so it is
   * never looked up: it is recorded as unfunded (`isDestinationFunded: false`)
   * straight away, as `searchAddress` does. Any other destination starts with
   * an unknown funding status (`null`) until its account lookup settles.
   *
   * @param address The destination address
   * @param fedAddress The federation address the destination came from, if any
   */
  setDestinationAddress: (address: string, fedAddress?: string) => {
    const { network } = useAuthenticationStore.getState();

    if (isContractDestination(address)) {
      set({
        destinationAddress: address,
        federationAddress: fedAddress || "",
        isValidDestination: true,
        isDestinationFunded: false,
      });
      return;
    }

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

  prepareForSearch: () => {
    set(SEARCH_RESET_STATE);
  },

  resetSendRecipient: () => {
    set({
      ...initialState,
    });
  },
}));
