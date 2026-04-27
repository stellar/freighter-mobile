# Performance

Performance guidelines for the Freighter Mobile React Native codebase.

> **Stack context.** The app runs the New Architecture (Fabric + TurboModules /
> JSI, `newArchEnabled=true`). Check `package.json` for the exact React version.
> The React Compiler is **not enabled** — manual `useMemo` / `useCallback` /
> `React.memo` are required until that changes.

## React.memo

**RULE: Memoize ALL components rendered in `FlatList` / `SectionList` / `map()`
renders.**

```tsx
export const ProtocolRow = React.memo(({ item, onPress }: ProtocolRowProps) => {
  return <TouchableOpacity onPress={onPress}>...</TouchableOpacity>;
});
```

## useMemo

**RULE: Wrap in `useMemo` when:**

1. Computing derived values from store data (filtered lists, formatted amounts)
2. Creating objects/arrays passed as props to memoized children
3. Computing style objects inside component bodies

```tsx
const visibleCollectibles = useMemo(
  () => collectibles.filter((c) => !c.isHidden),
  [collectibles],
);

const trackStyle = useMemo(
  () => ({ backgroundColor: isChecked ? colors.active : colors.inactive }),
  [isChecked, colors],
);
```

## useCallback

**RULE: ALL callbacks passed to child components or used in `FlatList` MUST use
`useCallback`.**

```tsx
const renderItem = useCallback(
  ({ item }: { item: Operation }) => (
    <HistoryItem operation={item} onPress={handleDetails} />
  ),
  [handleDetails],
);

const handleRefresh = useCallback(async () => {
  await fetchBalances(publicKey);
}, [fetchBalances, publicKey]);
```

## FlatList Optimization

**RULE: Every FlatList MUST include these props:**

```tsx
<FlatList
  data={items}
  renderItem={renderItem} // MUST be useCallback-wrapped
  keyExtractor={(item) => item.id} // MUST use stable ID, never index
  windowSize={5} // REQUIRED — controls render window
  maxToRenderPerBatch={10} // REQUIRED — batch size
  removeClippedSubviews // REQUIRED for long lists
  initialNumToRender={10} // RECOMMENDED
  getItemLayout={getItemLayout} // RECOMMENDED for fixed-height items (improves scroll-to-index perf)
/>
```

**RULE: Never use `ScrollView` for lists exceeding ~50 items. Use `FlatList`
with virtualization.**

### FlashList for heavy lists

For lists exceeding ~100 items or with complex item layouts (e.g., balances and
history), prefer **`@shopify/flash-list`**. FlashList uses cell recycling and
outperforms `FlatList` significantly on long lists. Requires the
`estimatedItemSize` prop.

## Key Props

**RULE: Never use `Math.random()` in `key` or `keyExtractor`.** It generates a
new key on every render, forcing React to unmount and remount every item — far
worse than `index` as key.

```tsx
// WRONG — generates a new key every render, forces full remount
keyExtractor={(item) => item.id || `balance-${Math.random()}`}

// CORRECT — stable fallback chain
keyExtractor={(item) => item.id ?? item.tokenCode ?? `${item.index}`}
```

**RULE: Never use array index as key.** Use stable unique identifiers.

## Zustand Selector Patterns

**RULE: Prefer Zustand selectors over destructuring the entire store for new
components and hot paths** (lists, frequently-rendered screens). Destructuring
re-renders on any state change in that store. Most existing code uses
destructuring — migrate to selectors in new components and hot paths; don't
refactor existing destructuring unless you're already touching the component for
another reason.

```tsx
// Avoid for new components and hot paths — subscribes to the entire store
const { tabs, activeTabId, isTabActive } = useBrowserTabsStore();

// Prefer — selective subscription
const tabs = useBrowserTabsStore((state) => state.tabs);
const activeTabId = useBrowserTabsStore((state) => state.activeTabId);
```

For multiple fields, use shallow comparison:

```tsx
import { useShallow } from "zustand/react/shallow";

const { tabs, activeTabId } = useBrowserTabsStore(
  useShallow((state) => ({ tabs: state.tabs, activeTabId: state.activeTabId })),
);
```

## Inline Functions in JSX

**RULE: Extract inline handlers to `useCallback`. Extract inline styles to
`useMemo` or constants.**

```tsx
// WRONG
<ContactRow onPress={() => onContactPress(item.address)} />;

// CORRECT
const handlePress = useCallback(
  () => onContactPress(item.address),
  [onContactPress, item.address],
);
<ContactRow onPress={handlePress} />;
```

## Image Optimization

**RULE: Use `FastImage` (`@d11/react-native-fast-image`) for ALL remote images
(token icons, NFTs, profile images).**

```tsx
import FastImage from "@d11/react-native-fast-image";

<FastImage
  source={{ uri: tokenIconUrl }}
  style={{ width: 40, height: 40 }}
  resizeMode={FastImage.resizeMode.contain}
/>;
```

Always specify `resizeMode`. Implement loading placeholders with `Animated`
opacity fade. See `src/components/sds/Token/index.tsx` for the reference
pattern.

## Reanimated Patterns

**RULE: Use Reanimated for animations that need 60fps. Keep animation logic in
`useAnimatedStyle` worklets. Don't introduce new JS-thread animations.**

```tsx
// CORRECT — runs on UI thread
const animatedStyle = useAnimatedStyle(() => ({
  opacity: withTiming(isVisible.value ? 1 : 0),
}));

// Avoid for new animations — runs on JS thread
const [opacity] = useState(new Animated.Value(0));
```

> Some existing code still uses `Animated` from React Native. Don't refactor it
> unless you're already touching the component; prefer Reanimated for any new
> animation work.

## useEffect Patterns

**RULE: Every `useEffect` with subscriptions, timers, or listeners MUST return a
cleanup function.**

```tsx
useEffect(() => {
  const subscription = Keyboard.addListener("keyboardDidShow", handler);
  return () => subscription.remove();
}, []);
```

## Hook Return Memoization

**RULE: Custom hooks returning objects MUST memoize the return value.**

```tsx
const useAccountData = (publicKey: string) => {
  const balances = useBalancesStore((state) => state.balances);
  const items = useMemo(
    () => balances.filter((b) => b.publicKey === publicKey),
    [balances, publicKey],
  );
  return useMemo(() => ({ items, isLoading }), [items, isLoading]);
};
```

## Defer Work Off the Critical Path

Use `InteractionManager.runAfterInteractions()` to defer non-urgent work
(analytics, large reductions, secondary fetches) until after navigation
transitions complete:

```tsx
useEffect(() => {
  const task = InteractionManager.runAfterInteractions(() => {
    runExpensiveBackground();
  });
  return () => task.cancel();
}, []);
```

## Navigation Performance

The project uses `react-native-screens`:

- **`enableFreeze()`** — not currently enabled; consider adding it at app entry
  to suspend offscreen screens and prevent them from re-rendering when
  invisible.
- **`useFocusEffect`** — scope work to screen visibility. For visibility-tied
  polling, use the existing `useFocusedPolling` hook.

## Pagination for Unbounded Lists

For lists that grow indefinitely (e.g., transaction history), implement
pagination / infinite scroll instead of fetching the full list. Couple
`FlatList`'s `onEndReached` with a backend cursor and append batches.

## Measuring Performance

Verify perf changes with measurement, not intuition:

- **React DevTools Profiler** — flame graphs of component renders.
- **`<React.Profiler>`** — programmatic per-render timings around suspect
  subtrees.
- **Reanimated FPS monitor** — confirm animations stay on the UI thread at
  60fps.
- **Hermes / Flipper trace** — for startup and TTI (time-to-interactive)
  regressions.

Measure before and after every perf change.
