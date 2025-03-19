import { Networks } from "@stellar/stellar-sdk";
import { KeyType } from "@stellar/typescript-wallet-sdk-km";
import { NETWORKS, STORAGE_KEYS } from "config/constants";
import { Account, KeyPair } from "config/types";
import { deriveKeyFromString } from "helpers/deriveKeyFromString";
import { createKeyManager } from "helpers/keyManager";
import { ScryptEncrypter } from "helpers/scryptEncrypter";
import { dataStorage } from "services/storage/storageFactory";
import { generateMnemonic, fromMnemonic } from "stellar-hd-wallet";
import { create } from "zustand";

/**
 * Authentication State Interface
 *
 * Defines the structure of the Authentication state store using Zustand.
 * This store manages the user's authentication status, including the current
 * user's public key and network, and methods to log in and log out.
 *
 * @interface AuthenticationState
 * @property {string | null} publicKey - The current user's public key
 * @property {NETWORKS | null} network - The current network the user is connected to
 * @property {boolean} isAuthenticated - Whether the user is currently authenticated
 * @property {boolean} isLoading - Whether the authentication state is currently being fetched
 * @property {string | null} error - Any error message, or null if no error
 * @property {Function} login - Function to log in a user (not implemented yet)
 * @property {Function} logout - Function to log out a user
 * @property {Function} signUp - Function to sign up a user (generate a new seed phrase and derive a public key)
 * @property {Function} getIsAuthenticated - Function to get the authenticated status of the user
 */
interface AuthenticationState {
  publicKey: string | null;
  network: NETWORKS | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  signUp: (params: { password: string }) => Promise<void>;
  getIsAuthenticated: () => Promise<boolean>;
}

const keyManager = createKeyManager(Networks.TESTNET);

/* Append an additional account to user's account list */
const storeAccountAction = async ({
  mnemonicPhrase,
  password,
  keyPair,
  imported = false,
}: {
  mnemonicPhrase: string;
  password: string;
  keyPair: KeyPair;
  imported?: boolean;
  isSettingHashKey?: boolean;
}) => {
  const { publicKey, privateKey } = keyPair;

  const activeHashKey = await deriveKeyFromString(password);

  if (activeHashKey === null) {
    throw new Error("Error deriving hash key");
  }

  const keyMetadata = {
    key: {
      extra: { imported, mnemonicPhrase },
      type: KeyType.plaintextKey,
      publicKey,
      privateKey,
    },
    password,
    encrypterName: ScryptEncrypter.name,
  };

  let keyStore = { id: "" };

  keyStore = await keyManager.storeKey(keyMetadata);

  const keyIdListRaw = await dataStorage.getItem(STORAGE_KEYS.KEY_ID_LIST);
  const keyIdList = keyIdListRaw ? (JSON.parse(keyIdListRaw) as string[]) : [];
  keyIdList.push(keyStore.id);

  const accountListRaw = await dataStorage.getItem(STORAGE_KEYS.ACCOUNT_LIST);
  const accountList = accountListRaw
    ? (JSON.parse(accountListRaw) as Account[])
    : [];

  const accountName = `Account ${accountList.length + 1}`;

  await dataStorage.setItem(
    STORAGE_KEYS.KEY_ID_LIST,
    JSON.stringify(keyIdList),
  );
  await dataStorage.setItem(STORAGE_KEYS.KEY_ID, keyStore.id);
  await dataStorage.setItem(STORAGE_KEYS.ACTIVE_ACCOUNT, keyStore.id);
  await dataStorage.setItem(
    STORAGE_KEYS.ACCOUNT_LIST,
    JSON.stringify([
      ...accountList,
      {
        publicKey: keyPair.publicKey,
        name: accountName,
        imported,
        mnemonicPhrase,
      },
    ]),
  );
};

const signUpAction = async (params: { password: string }) => {
  const { password } = params;

  const mnemonicPhrase = generateMnemonic({ entropyBits: 128 });
  const wallet = fromMnemonic(mnemonicPhrase);

  const keyDerivationNumber = 0;
  const keyId = keyDerivationNumber.toString();

  await dataStorage.setItem(STORAGE_KEYS.KEY_DERIVATION_NUMBER_ID, keyId);

  const keyPair = {
    publicKey: wallet.getPublicKey(keyDerivationNumber),
    privateKey: wallet.getSecret(keyDerivationNumber),
  };

  try {
    await storeAccountAction({
      mnemonicPhrase,
      password,
      keyPair,
    });
  } catch (error) {
    console.error("Error creating account", error);

    return {
      error: "Error creating account",
    };
  }

  return {
    publicKey: keyPair.publicKey,
    mnemonicPhrase,
  };
};

/**
 * Authentication Store
 *
 * A Zustand store that manages the state of account balances in the application.
 * Handles fetching, storing, and error states for token balances.
 */
export const useAuthenticationStore = create<AuthenticationState>((set) => ({
  publicKey: null,
  network: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  login: () => {
    // Not implemented yet
  },
  logout: () => {
    set({ publicKey: null, network: null, isAuthenticated: false });
  },
  signUp: async (params) => {
    const { password } = params;

    try {
      set({ isLoading: true, error: null });

      const { publicKey } = await signUpAction({ password });

      set({
        publicKey: publicKey!,
        network: NETWORKS.TESTNET,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to sign up",
        isLoading: false,
      });
    }
  },
  getIsAuthenticated: async () => {
    const activeAccount = await dataStorage.getItem(
      STORAGE_KEYS.ACTIVE_ACCOUNT,
    );

    return activeAccount !== null;
  },
}));
