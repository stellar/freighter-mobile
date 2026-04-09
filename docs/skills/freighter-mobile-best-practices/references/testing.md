# Testing

## Jest Unit Tests

Configuration:

- **Preset**: `react-native`
- **Timeout**: 30 seconds
- **Setup files**: `jest.setup.js` + `@shopify/react-native-skia/jestSetup.js`
- **Module mapper**: Handles path aliases (`getSrcDirs`), SVG mocks,
  service/helper mocks
- **Transform**: `babel-jest` for TypeScript/JavaScript, with a whitelist of
  React Native packages that need transpilation

## Test Location

Tests live in `__tests__/` parallel to `src/`, mirroring the source directory
structure:

```
src/
  hooks/useAuth.ts
  ducks/prices.ts
__tests__/
  hooks/useAuth.test.ts
  ducks/prices.test.ts
```

## Mocking Patterns

### Mocking services and stores

```tsx
jest.mock("services/backend", () => ({
  fetchBalances: jest.fn().mockResolvedValue([]),
  fetchPrices: jest.fn().mockResolvedValue({}),
}));

jest.mock("ducks/prices", () => ({
  usePricesStore: jest.fn(() => ({
    prices: { XLM: 0.12 },
    isLoading: false,
  })),
}));
```

### Testing Zustand stores

```tsx
import { renderHook, act } from "@testing-library/react-hooks";
import { useMyStore } from "ducks/myStore";

it("should update state", () => {
  const { result } = renderHook(() => useMyStore());

  act(() => {
    useMyStore.setState({ isLoading: true });
  });

  expect(result.current.isLoading).toBe(true);
});
```

## Maestro End-to-End Tests

Maestro provides YAML-based e2e test flows located in `e2e/flows/`:

### Available Test Flows (7 total)

1. `CreateWallet` — Full wallet creation flow
2. `ImportWallet` — Import via recovery phrase
3. `ImportFundedWallet` — Import a pre-funded wallet
4. `SendClassicTokenMainnet` — Send a classic Stellar token on mainnet
5. `SwapClassicTokenMainnet` — Swap tokens on mainnet
6. `SignMessageMockDapp` — Sign a message via WalletConnect mock dApp
7. `SignAuthEntryMockDapp` — Sign a Soroban auth entry via WalletConnect mock
   dApp

### E2E Prerequisites

- Maestro CLI installed
- `IS_E2E_TEST=true` set in `.env`
- Test recovery phrases configured in environment variables
- iOS Simulator or Android Emulator running

### E2E Documentation

Six guides are available in `e2e/docs/`:

- `ci-and-triggers` — CI pipeline configuration
- `local-setup-and-env` — Local environment setup
- `running-tests` — How to run tests
- `artifacts-and-debugging` — Test artifacts and debugging
- `creating-tests` — Writing new Maestro tests
- `walletconnect-e2e-testing` — WalletConnect-specific e2e testing

## Running Tests

| Command                        | Purpose                                |
| ------------------------------ | -------------------------------------- |
| `yarn test`                    | Run Jest suite once                    |
| `yarn test:watch`              | Run Jest in watch mode                 |
| `yarn test:e2e:ios <flow>`     | Run a Maestro flow on iOS Simulator    |
| `yarn test:e2e:android <flow>` | Run a Maestro flow on Android Emulator |

## CI Pipelines

| Workflow          | Trigger             | What It Does                               |
| ----------------- | ------------------- | ------------------------------------------ |
| `test.yml`        | Push / PR           | Runs the Jest test suite                   |
| `ios-e2e.yml`     | Configured triggers | Runs Maestro iOS tests on macOS runner     |
| `android-e2e.yml` | Configured triggers | Runs Maestro Android tests on Linux runner |
