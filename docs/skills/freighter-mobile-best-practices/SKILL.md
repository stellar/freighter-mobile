---
name: freighter-mobile-best-practices
description:
  Comprehensive best practices for the Freighter Mobile React Native app (iOS +
  Android). Covers code style, architecture, security, testing, performance,
  error handling, i18n, styling, WalletConnect, navigation, git workflow,
  dependencies, and anti-patterns. Use when writing new screens, creating
  Zustand stores, adding hooks, working with WalletConnect, handling secure key
  storage, writing navigation flows, building transactions, styling components,
  reviewing mobile PRs, or any development work in the freighter-mobile repo.
  Triggers on any task touching the freighter-mobile codebase.
---

# Freighter Mobile Best Practices

Freighter Mobile is a non-custodial Stellar wallet built with React Native,
targeting both iOS and Android. The app uses Zustand for state management, React
Navigation for routing, NativeWind for styling, and Maestro for end-to-end
testing.

## Quick Rules

Apply these on every task — they are the most commonly missed patterns:

**Code style**
- Arrow function expressions only — no `function` declarations for components
- Screens → `export default`; hooks, components, helpers → named exports
- Absolute imports only — no `../../` relative paths
- All user-facing strings through `useAppTranslation()` (not raw `useTranslation()`) and `t()`; both `en` and `pt` translations required

**UI & styling**
- NativeWind `className` for layout/spacing; `StyleSheet.create` only for dynamic prop-driven styles
- `FastImage` (`@d11/react-native-fast-image`) for **all** remote images — never the RN `Image` component
- Toast system for user-facing errors — never `Alert.alert()` in app code

**Lists & performance**
- Wrap every list-item component in `React.memo()`
- Wrap `renderItem` in `useCallback`
- Every `FlatList` needs: `windowSize={5}`, `maxToRenderPerBatch={10}`, `removeClippedSubviews`; stable `keyExtractor` (never index)
- For lists exceeding ~100 items use `FlashList` (`@shopify/flash-list`) instead of `FlatList`
- Multi-field Zustand selectors require `useShallow` from `zustand/react/shallow`

**Zustand stores**
- Async actions: `set({ isLoading: true, error: null })` before `try`
- Catch blocks: `normalizeError(error)` for the error message string; `logger.error()` for logging — never `console.error` or `Sentry.captureException()` directly
- Stores set `error` state only — toast is a UI-layer concern called by the component watching `error`

**WalletConnect**
- Always check and set `hasRespondedRef` (a React `useRef`, not a Set/Map) before responding to any session request
- Validate all request parameters with functions from `walletKitValidation.ts` before processing
- Blockaid results: `malicious` / `suspicious` / `scan-failed` → show warning banner, user decides (confirm anyway or cancel); `benign` → proceed normally

## Reference Index

| Concern              | File                         | When to Read                                        |
| -------------------- | ---------------------------- | --------------------------------------------------- |
| Code Style           | references/code-style.md     | Writing or reviewing any code                       |
| Architecture         | references/architecture.md   | Adding features, understanding the codebase         |
| Styling              | references/styling.md        | Creating or modifying UI components                 |
| Security             | references/security.md       | Touching keys, auth, storage, or dApp interactions  |
| Testing              | references/testing.md        | Writing or fixing tests                             |
| Performance          | references/performance.md    | Optimizing renders, lists, images, or startup       |
| Error Handling       | references/error-handling.md | Adding error states, retries, or user-facing errors |
| Internationalization | references/i18n.md           | Adding or modifying user-facing strings             |
| WalletConnect        | references/walletconnect.md  | Working with dApp connections or RPC methods        |
| Navigation           | references/navigation.md     | Adding screens, deep links, or navigation flows     |
| Git & PR Workflow    | references/git-workflow.md   | Branching, committing, opening PRs, CI, releases    |
| Dependencies         | references/dependencies.md   | Adding, updating, or auditing packages              |
| Anti-Patterns        | references/anti-patterns.md  | Code review, avoiding common mistakes               |
