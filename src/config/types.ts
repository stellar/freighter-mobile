export type Account = {
  publicKey: string;
  name: string;
  imported?: boolean;
  mnemonicPhrase?: string;
};

export type KeyPair = {
  publicKey: string;
  privateKey: string;
};
