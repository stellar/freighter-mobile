// Canonical cross-platform auth-keypair vectors — MUST match the extension's
// committed values (stellar/freighter @shared/api/helpers/authKeypairVectors.ts).
// SOURCE OF TRUTH: wallet-eng-monorepo design-docs/contact-lists/Freighter Auth Keypair Derivation Design Doc.md
export interface AuthKeypairVector {
  mnemonic: string;
  authSeedHex: string;
  userId: string;
}
export const AUTH_KEYPAIR_VECTORS: AuthKeypairVector[] = [
  {
    mnemonic:
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
    authSeedHex:
      "cf8ef34afb730ffd0807ee8731f2378a4f6c702e2f14915976fac4afa711b52d",
    userId: "ec57e5d04783b5ade776621ab171b3b197c3acc0a1cb5bad10786dc8e381e797",
  },
  {
    mnemonic:
      "illness spike retreat truth genius clock brain pass fit cave bargain toe",
    authSeedHex:
      "882835b30a2c5b011f1b2424a84f4cd39f342f4d12be574e4233dbf9b98976d1",
    userId: "bd9498475c7191c5e9a5e18edda2402ab0ae527580a6c38b2a32a77c65729cd7",
  },
];
