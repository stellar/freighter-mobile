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
  hooks/useGetActiveAccount.ts
  ducks/prices.ts
__tests__/
  hooks/useGetActiveAccount.test.ts
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
// Use @testing-library/react-native (preferred) — @testing-library/react-hooks
// is deprecated and should not be used for new tests.
import { renderHook, act } from "@testing-library/react-native";
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

### Available Test Flows

See `e2e/flows/` for the current set of flows, organized by subdirectory:
`onboarding/`, `transactions/`, `walletconnect/`, `shared/`, `debug/`. Each YAML
file is a runnable flow named after its test scenario.

### E2E Prerequisites

- Maestro CLI installed
- `IS_E2E_TEST=true` set in `.env`
- Test recovery phrases configured in environment variables
- iOS Simulator or Android Emulator running

### E2E Documentation

Some guides are available in `e2e/docs/`. E.g.:

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
