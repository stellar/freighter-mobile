# Security

## Three-Tier Storage (storageFactory.ts)

The app enforces a strict storage hierarchy via `storageFactory.ts`:

| Tier                   | Implementation                                            | Use For                                              |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| `secureDataStorage`    | `react-native-keychain` (iOS Keychain / Android Keystore) | Private keys, seed phrases, encrypted credentials    |
| `biometricDataStorage` | Biometric-gated keychain access                           | Passwords that require biometric confirmation        |
| `dataStorage`          | AsyncStorage                                              | Non-sensitive settings, preferences, cached UI state |

**Rule: Never use AsyncStorage for keys, seeds, or passwords.** Always use
`secureDataStorage` or `biometricDataStorage` from `storageFactory`.

## Password Encryption

Passwords are encrypted using the Stellar TypeScript wallet SDK:

- `ScryptEncrypter` from `@stellar/typescript-wallet-sdk-km`
- `generateSalt()` for unique salts per encryption
- `deriveKeyFromPassword()` for key derivation

## Auth State Machine

Authentication uses a state machine. `AUTH_STATUS` (in `src/config/types.ts`) is
a `const` object with `as const` (not a TypeScript `enum`) — read values via
`AUTH_STATUS.AUTHENTICATED`, etc., and reference its type via
`(typeof AUTH_STATUS)[keyof typeof AUTH_STATUS]`. Do not declare a new
`enum AUTH_STATUS`.

| Status              | Meaning                                    |
| ------------------- | ------------------------------------------ |
| `NOT_AUTHENTICATED` | No account exists, show onboarding         |
| `HASH_KEY_EXPIRED`  | Session expired, require re-authentication |
| `AUTHENTICATED`     | Active session, full app access            |
| `LOCKED`            | App locked, require unlock                 |

Periodic auth checks run at different intervals based on app state:

- **Active (foreground, interacting)**: Every 5 seconds
- **Foreground (visible, not interacting)**: Every 10 seconds
- **Background**: Every 60 seconds

## Biometric Authentication

The `useBiometrics` hook manages biometric auth:

- `checkBiometrics()` — verifies biometric availability on device
- `initBiometricPassword()` — stores password behind biometric gate
- `biometricDataStorage.checkIfExists()` — checks if biometric credentials are
  enrolled

## WalletConnect Security

Every dApp transaction goes through Blockaid security scanning:

| Scan Result   | Action                        |
| ------------- | ----------------------------- |
| `malicious`   | Show warning, let user decide |
| `suspicious`  | Show warning, let user decide |
| `benign`      | Process normally              |
| `scan-failed` | Show warning, let user decide |

Additional WalletConnect validations:

- Validate the chain matches the active Stellar network (`stellar:pubnet` or
  `stellar:testnet`)
- Parse and validate XDR content before signing
- Check message content and length for `stellar_signMessage`
- Validate auth entry network for `stellar_signAuthEntry`

## Deep Link Security

- Validate all URL parameters before processing
- Only accept known deep link formats
- Never execute arbitrary code from deep link parameters
- Dev and prod use separate deep-link schemes (see native project config)

## Dual Bundle ID Isolation

Dev and prod builds use completely separate keychain entries. This means:

- Installing the dev build cannot read prod secrets
- Testing never touches production credentials
- Push tokens and deep links are isolated per environment

## Common Security Mistakes to Avoid

- **Logging key material**: Never `console.log` keys, seeds, or passwords, even
  in `__DEV__` mode
- **AsyncStorage for secrets**: Always use `secureDataStorage` or
  `biometricDataStorage`
- **Trusting dApp display names**: WalletConnect session info (app name, icon)
  comes from the dApp and can be spoofed. Never use it for security decisions.
- **Skipping network validation**: Always verify the WalletConnect request chain
  matches the active Stellar network
- **Hardcoding test keys**: Use environment variables
  (`E2E_TEST_RECOVERY_PHRASE`) for test secrets
