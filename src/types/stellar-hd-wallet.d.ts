declare module "stellar-hd-wallet" {
  export function generateMnemonic(params: {
    entropyBits?: number;
    language?: string;
    rngFn?: () => Buffer;
  }): string;
  export function fromMnemonic(
    mnemonic: string,
    password?: string,
    language?: string,
  ): Wallet;

  export type Wallet = {
    getPublicKey: (index: number) => string;
    getSecret: (index: number) => string;
  };
}
