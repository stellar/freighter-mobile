import { KeyManager } from "@stellar/typescript-wallet-sdk-km";
import { ReactNativeKeychainKeyStore } from "helpers/keyManager/ReactNativeKeychainKeyStore";
import { ScryptEncrypter } from "helpers/keyManager/ScryptEncrypter";

export function createKeyManager(networkPassphrase: string): KeyManager {
  const keyStore = new ReactNativeKeychainKeyStore();

  // Configure the secure store with default options
  keyStore.configure();

  const keyManager = new KeyManager({
    keyStore,
    defaultNetworkPassphrase: networkPassphrase,
  });

  keyManager.registerEncrypter(ScryptEncrypter);

  return keyManager;
}
