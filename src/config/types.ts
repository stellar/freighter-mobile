export type Account = {
  id: string;
  name: string;
  publicKey: string;
  imported?: boolean;
};

export type KeyPair = {
  publicKey: string;
  privateKey: string;
};

export interface TemporaryStore {
  expiration: number;
  privateKeys: Record<string, string>;
  mnemonicPhrase: string;
}
