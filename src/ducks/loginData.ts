import { create } from "zustand";

/**
 * Login Data State Interface
 *
 * Defines the structure of the login data state store using Zustand.
 * This store manages sensitive login data (password and mnemonic phrase) in memory only.
 * Data is never persisted to disk or navigation state for security.
 *
 * @interface LoginDataState
 * @property {string | null} mnemonicPhrase - The mnemonic phrase (null if not set)
 * @property {string | null} password - The password (null if not set)
 * @property {Function} setMnemonicPhrase - Function to set the mnemonic phrase
 * @property {Function} clearMnemonicPhrase - Function to clear the mnemonic phrase
 * @property {Function} setPassword - Function to set the password
 * @property {Function} clearPassword - Function to clear the password
 * @property {Function} clearAll - Function to clear all login data
 */
interface LoginDataState {
  mnemonicPhrase: string | null;
  password: string | null;

  setMnemonicPhrase: (phrase: string | null) => void;
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
 * const { clearAll } = useLoginDataStore();
 * clearAll();
 */
export const useLoginDataStore = create<LoginDataState>((set) => ({
  mnemonicPhrase: null,
  password: null,

  setMnemonicPhrase: (phrase: string | null) => {
    set({ mnemonicPhrase: phrase });
  },

  setPassword: (password: string | null) => {
    set({ password });
  },

  clearLoginData: () => {
    set({ mnemonicPhrase: null, password: null });
  },
}));
