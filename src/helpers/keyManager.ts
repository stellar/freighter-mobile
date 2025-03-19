import { KeyManager, MemoryKeyStore } from "@stellar/typescript-wallet-sdk-km";
import { ScryptEncrypter } from "helpers/scryptEncrypter";

export function createKeyManager(networkPassphrase: string): KeyManager {
  const keyManager = new KeyManager({
    keyStore: new MemoryKeyStore(),
    defaultNetworkPassphrase: networkPassphrase,
  });

  keyManager.registerEncrypter(ScryptEncrypter);

  return keyManager;
}
