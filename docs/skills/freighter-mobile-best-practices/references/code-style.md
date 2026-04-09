# Code Style

## Prettier Configuration (.prettierrc.json)

- **Quotes**: Double quotes (`singleQuote: false`)
- **Indentation**: 2-space indent
- **Print width**: 80 characters
- **Trailing commas**: `all` (including function parameters)
- **Semicolons**: Always
- **Arrow parens**: Always (`arrowParens: "always"`)
- **Import sorting**: `@trivago/prettier-plugin-sort-imports` plugin. Imports
  use absolute paths from `src/` root (no `@/` prefix). ESLint handles grouping:
  builtin > external > internal > parent > sibling > index

## ESLint Configuration (eslint.config.mjs)

Extends:

- Airbnb
- Airbnb TypeScript
- Airbnb Hooks
- `@typescript-eslint/recommended`
- `@typescript-eslint/recommended-requiring-type-checking`
- Prettier (disables conflicting rules)

### Key Rules

**Arrow functions enforced**: `react/function-component-definition` is set to
`error` for both named and unnamed components. All components must use arrow
function expressions:

```tsx
// Correct
const MyComponent: React.FC<Props> = ({ title }) => {
  return <View><Text>{title}</Text></View>;
};

// Wrong - will fail lint
export function MyComponent({ title }: Props) {
  return <View><Text>{title}</Text></View>;
}
```

**Absolute imports only**: `@fnando/eslint-plugin-consistent-import` enforces
imports from `src/` root with `disallowRelative: true`:

```tsx
// Correct
import { useAuth } from "hooks/useAuth";

// Wrong - will fail lint
import { useAuth } from "../../hooks/useAuth";
```

**Import ordering**: Groups ordered as builtin > external > internal > parent >
sibling > index. Newlines required between groups. Alphabetical sorting within
each group.

**No floating promises**: `@typescript-eslint/no-floating-promises` is currently
**disabled** (`"off"` in eslint.config.mjs). Promises are not required to be
awaited or caught by lint, but best practice is to always handle them.

**No unsafe assignments/calls/returns**: Enforced in production code. Relaxed
only in test files.

**Translation enforcement**: Custom ESLint plugin
(`src/eslint-plugin-translations/`) flags missing translation keys as errors.
Every user-facing string must go through `t()`.

### Test File Relaxation

TypeScript strict rules are relaxed in these patterns:

- `**/*.test.ts`
- `**/*.test.tsx`
- `__tests__/**/*`

## File Naming Conventions

- **Components**: PascalCase directories (e.g., `SendPayment/`, `AccountCard/`)
- **Hooks**: `useXxx.ts` (e.g., `useAuth.ts`, `useBiometrics.ts`)
- **Ducks (stores)**: `featureName.ts` (e.g., `prices.ts`, `walletKit.ts`)
- **Helpers**: camelCase (e.g., `formatBalance.ts`, `stellarHelpers.ts`)

## Pre-Commit Hooks (.husky/pre-commit)

Three checks run in sequence on every commit:

1. **lint-staged**: Runs ESLint `--fix` and Prettier on staged files
2. **yarn test**: Runs the full Jest test suite
3. **yarn lint:ts**: TypeScript type checking

## lint-staged Configuration

- `*.{js,jsx,ts,tsx}` -> `eslint --fix` + `prettier --write`
- `*.{json,md,yml,yaml}` -> `prettier --write`

## Code Review Guidelines

The following conventions are enforced during code review (not automated via
ESLint plugins):

- **enum-over-type** -- prefer enums over type union literals for finite named
  sets
- **no-loose-strings** -- all user-facing strings must use i18n `t()` calls
- **no-magic-numbers** -- extract numeric literals into named constants
- **i18n-pt-en** -- every user-facing string must have both English and
  Portuguese translations

The custom ESLint plugin at `src/eslint-plugin-translations/` enforces
translation key presence automatically.

## Detailed Patterns (Based on 434-file Analysis)

### Destructuring

Inline parameter destructuring is the dominant pattern (90%+):

```tsx
// STANDARD — inline destructuring (90%+ of components)
const BalanceRow = ({ balance, scanResult }: BalanceRowProps) => { ... };

// LESS COMMON — separate destructuring
const BalanceRow = (props: BalanceRowProps) => {
  const { balance, scanResult } = props;
};
```

For Zustand stores, direct hook calls dominate (70%) over selectors (30%):

```tsx
// DOMINANT (70%) — direct hook call
const { balances, isLoading } = useBalancesStore();

// USED FOR PERF (30%) — selector to subscribe to specific data
const balances = useBalancesStore((state) => state.balances);
```

### Optional Chaining and Nullish Coalescing

`&&` is 1.9x more common than `?.` (2700+ vs 921 occurrences). Both are
acceptable:

```tsx
// Conditional rendering — always use &&
{
  isMalicious && <WarningBadge />;
}

// Property access — use ?.
const fiatTotal = balance?.fiatTotal;
```

Nullish coalescing `??` (175 occurrences) is preferred over `||` for new code
when preserving `0`/`""`:

```tsx
const timeout = config.timeout ?? DEFAULT_TIMEOUT; // PREFERRED
```

### Export Patterns

Named exports dominate (70%), default exports for screens (30%):

```tsx
// SCREENS — default export (100% of screens)
export default HomeScreen;

// HOOKS/HELPERS/SERVICES — named export (95%+)
export const useColors = () => { ... };
export const fetchBalances = async () => { ... };
```

### Component Prop Types

Separate interfaces are standard (95%+). `React.FC<Props>` is used in ~45% of
components — both patterns are acceptable:

```tsx
// BOTH ACCEPTABLE
const BalanceRow: React.FC<BalanceRowProps> = ({ balance }) => { ... };
const BalanceRow = ({ balance }: BalanceRowProps) => { ... };
```

### Naming Deep Dive

| Category          | Convention                                          | Evidence                    |
| ----------------- | --------------------------------------------------- | --------------------------- |
| Screen components | `XxxScreen` suffix always                           | 40+ screens, 100% adherence |
| Hooks             | `useXxx` always                                     | 57 hooks, 100% adherence    |
| Zustand stores    | `useXxxStore`                                       | 24 ducks, 100% adherence    |
| Store actions     | verb + noun (`fetchBalances`, `clearData`)          | 95%+                        |
| Constants         | SCREAMING_SNAKE_CASE in `config/constants.ts`       | 95%+                        |
| Types/Interfaces  | PascalCase with `Props`, `State`, `Config` suffixes | 500+ types, 100%            |
| Enum values       | Mixed PascalCase/SCREAMING_SNAKE per enum           | Context-dependent           |

### Conditional Rendering

`&&` pattern dominates (70%), ternary for either/or (25%), early returns rare
(5%):

```tsx
// MOST COMMON (70%)
{item.icon && <View>{item.icon}</View>}

// FOR EITHER/OR (25%)
{isLoading ? <Spinner /> : <Content />}

// RARE — early returns in hooks, not components
if (!data) return <EmptyState />;
```

### Async Patterns

`async/await` (85%) over `.then()` (15%). `Promise.all` used in 27 occurrences
(13 files):

```tsx
// STANDARD
const balances = await fetchBalances(publicKey);

// PARALLEL FETCHING
const [balances, prices] = await Promise.all([
  fetchBalances(publicKey),
  fetchPrices(assetCodes),
]);
```

### Type Assertions and Generics

Always `as Type` (TSX requirement). Prefer descriptive generic names (60%) over
single letters (40%):

```tsx
// PREFERRED
create<BalancesState>((set, get) => ({ ... }));

// ACCEPTABLE for simple cases
function identity<T>(value: T): T { return value; }
```

`any` count: 139 occurrences across 70 files (~3%) — mostly external API
integrations. Use `unknown` for new code.

### Styling Split

| Approach              | Usage                 | When                                |
| --------------------- | --------------------- | ----------------------------------- |
| NativeWind (Tailwind) | 45% (921 occurrences) | Layout, spacing, simple styles      |
| Inline style props    | 50%                   | Dynamic styles, conditional styling |
| styled-components     | 4% (18 occurrences)   | Complex themed components           |
| StyleSheet.create     | <1% (1 occurrence)    | Avoid for new code                  |

### String/Number Patterns

Template literals near-universal (95%+). All magic numbers extracted to
`config/constants.ts`:

```tsx
// ALL constants go in config/constants.ts
export const DEFAULT_PADDING = 24;
export const DEFAULT_ICON_SIZE = 24;
export const NATIVE_TOKEN_CODE = "XLM";
```

Error messages use i18n (`t()`) — no hardcoded error strings.
