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
