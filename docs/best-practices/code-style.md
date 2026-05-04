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

**No floating promises**: Always `await` promises or attach a `.catch()`
handler. See `anti-patterns.md` for examples. Note:
`@typescript-eslint/no-floating-promises` is disabled in ESLint
(`eslint.config.mjs`) — this is a reviewer-enforced convention, not a
linter-enforced rule.

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

The following conventions are enforced during code review:

- **enum-over-type** -- prefer enums over type union literals for finite named
  sets
- **no-loose-strings** -- all user-facing strings must use i18n `t()` calls
- **no-magic-numbers** -- extract numeric literals into named constants
- **i18n-pt-en** -- every user-facing string must have both English and
  Portuguese translations

The custom ESLint plugin at `src/eslint-plugin-translations/` enforces
translation key presence automatically.

## Detailed Patterns

### Destructuring

Use inline parameter destructuring for component props:

```tsx
const BalanceRow = ({ balance, scanResult }: BalanceRowProps) => { ... };
```

For Zustand stores, prefer selectors over destructuring the whole store.
Destructuring re-renders on every store update; selectors re-render only when
the selected slice changes. Note: most existing code still uses destructuring —
migrate to selectors in new components and hot paths (lists, frequently-rendered
screens). Don't refactor existing destructuring unless you're already touching
the component for other reasons.

```tsx
// Avoid — re-renders on every store update
const { balances, isLoading } = useBalancesStore();

// Prefer for new code — re-renders only when balances change
const balances = useBalancesStore((state) => state.balances);
```

### Optional Chaining and Nullish Coalescing

- Use `&&` for conditional rendering.
- Use `?.` for safe property access.
- Use `??` (not `||`) when you need to preserve `0` or `""` as valid values.

```tsx
{
  isMalicious && <WarningBadge />;
}

const fiatTotal = balance?.fiatTotal;

const timeout = config.timeout ?? DEFAULT_TIMEOUT;
```

### Export Patterns

- **Screens** — default export
- **Hooks, helpers, services, components** — named exports

```tsx
export default HomeScreen;

export const useColors = () => { ... };
export const fetchBalances = async () => { ... };
```

### Component Prop Types

Use a separate `Props` interface (or type) for every component. Both
`React.FC<Props>` and inline annotation are acceptable:

```tsx
const BalanceRow: React.FC<BalanceRowProps> = ({ balance }) => { ... };
const BalanceRow = ({ balance }: BalanceRowProps) => { ... };
```

### Naming

| Category          | Convention                                          |
| ----------------- | --------------------------------------------------- |
| Screen components | `XxxScreen` suffix                                  |
| Hooks             | `useXxx`                                            |
| Zustand stores    | `useXxxStore`                                       |
| Store actions     | verb + noun (`fetchBalances`, `clearData`)          |
| Constants         | `SCREAMING_SNAKE_CASE` in `config/constants.ts`     |
| Types/Interfaces  | PascalCase with `Props`, `State`, `Config` suffixes |
| Enum values       | PascalCase or `SCREAMING_SNAKE_CASE` per enum       |

### Conditional Rendering

```tsx
// Conditional render
{item.icon && <View>{item.icon}</View>}

// Either/or
{isLoading ? <Spinner /> : <Content />}

// Early return in hooks
if (!data) return <EmptyState />;
```

### Async Patterns

Use `async/await`. Use `Promise.all` to parallelize independent fetches:

```tsx
const balances = await fetchBalances(publicKey);

const [balances, prices] = await Promise.all([
  fetchBalances(publicKey),
  fetchPrices(assetCodes),
]);
```

### Type Assertions and Generics

Always use `as Type` (TSX requirement). Prefer descriptive generic names:

```tsx
create<BalancesState>((set, get) => ({ ... }));

function identity<T>(value: T): T { return value; }
```

Avoid `any` — use `unknown` and narrow with type guards.

### Styling

| Approach            | When                                 |
| ------------------- | ------------------------------------ |
| NativeWind          | Layout, spacing, simple styles       |
| `StyleSheet.create` | Dynamic / prop-driven complex styles |

See `styling.md` for examples.

### Strings and Numbers

Use template literals for string composition. Extract magic numbers into named
constants in `config/constants.ts`:

```tsx
export const DEFAULT_PADDING = 24;
export const DEFAULT_ICON_SIZE = 24;
export const NATIVE_TOKEN_CODE = "XLM";
```

User-facing error messages must use i18n (`t()`) — never hardcoded strings.
