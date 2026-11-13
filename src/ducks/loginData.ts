import { create } from "zustand";

/**
 * Login Data State Interface
 *
 * Defines the structure of the login data state store using Zustand.
 * This store manages sensitive login data (password, mnemonic phrase and an
 * onboarding secret key) in memory only.
 * Data is never persisted to disk or navigation state for security.
 *
 * At most one of `mnemonicPhrase` and `secretKey` is set: setting one clears
 * the other, so the wallet setup never has to pick between them.
 *
 * @interface LoginDataState
 * @property {string | null} mnemonicPhrase - The mnemonic phrase (null if not set)
 * @property {string | null} secretKey - The secret key Import Wallet was given (null if not set)
 * @property {string | null} password - The password (null if not set)
 * @property {Function} setMnemonicPhrase - Sets the mnemonic phrase and clears the secret key
 * @property {Function} setSecretKey - Sets the secret key and clears the mnemonic phrase
 * @property {Function} setPassword - Function to set the password
 * @property {Function} clearLoginData - Function to clear all login data
 */
interface LoginDataState {
  mnemonicPhrase: string | null;
  secretKey: string | null;
  password: string | null;

  setMnemonicPhrase: (phrase: string | null) => void;
  setSecretKey: (secretKey: string | null) => void;
  setPassword: (password: string | null) => void;
  clearLoginData: () => void;
}

/**
 * Login Data Store
 *
 * A Zustand store that manages sensitive login data in memory only.
 * This store is designed for security - data is never persisted and
 * is automatically cleared when the app terminates.
 *
 * Features:
 * - Memory-only storage (no persistence)
 * - Automatic cleanup functions
 * - Type-safe state management
 * - No navigation parameter exposure
 *
 * @example
 * // Set login data
 * const { setMnemonicPhrase, setPassword } = useLoginDataStore();
 * setMnemonicPhrase("word1 word2 word3...");
 * setPassword("userpassword");
 *
 * // Get login data
 * const { mnemonicPhrase, password } = useLoginDataStore();
 *
 * // Clear all data
 * const { clearLoginData } = useLoginDataStore();
 * clearLoginData();
 */
export const useLoginDataStore = create<LoginDataState>((set) => ({
  mnemonicPhrase: null,
  secretKey: null,
  password: null,

  setMnemonicPhrase: (phrase: string | null) => {
    set(
      phrase
        ? { mnemonicPhrase: phrase, secretKey: null }
        : { mnemonicPhrase: null },
    );
  },

  setSecretKey: (secretKey: string | null) => {
    set(secretKey ? { secretKey, mnemonicPhrase: null } : { secretKey: null });
  },

  setPassword: (password: string | null) => {
    set({ password });
  },

  clearLoginData: () => {
    set({ mnemonicPhrase: null, secretKey: null, password: null });
  },
}));
