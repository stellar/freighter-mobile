import {
  EncryptedKey,
  Encrypter,
  Key,
} from "@stellar/typescript-wallet-sdk-km";
import { decrypt, encrypt } from "helpers/keyManager/scryptEncrypterHelper";

const NAME = "ScryptEncrypter";

export const ScryptEncrypter: Encrypter = {
  name: NAME,
  async encryptKey({
    key,
    password,
  }: {
    key: Key;
    password: string;
  }): Promise<EncryptedKey> {
    const { privateKey, path, extra, publicKey, type, ...props } = key;

    const { encryptedPhrase, salt } = await encrypt({
      password,
      phrase: JSON.stringify({ privateKey, path, extra, publicKey, type }),
    });

    return {
      ...props,
      encryptedBlob: encryptedPhrase,
      encrypterName: NAME,
      salt,
    };
  },

  async decryptKey({
    encryptedKey,
    password,
  }: {
    encryptedKey: EncryptedKey;
    password: string;
  }) {
    const { encrypterName, salt, encryptedBlob, ...props } = encryptedKey;

    const data = JSON.parse(
      await decrypt({ phrase: encryptedBlob, salt, password }),
    );

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
      ...props,
      ...data,
    };
  },
};
