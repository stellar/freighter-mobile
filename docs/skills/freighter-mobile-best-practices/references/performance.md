# Performance -- Freighter Mobile

Performance guidelines for the Freighter Mobile React Native codebase.

## React.memo -- 28 usages across 25 files (GOOD)

Memoization is used for list items and screen components. No custom comparators
found.

**RULE: Memoize ALL components rendered in FlatList/SectionList/map() renders.**

```tsx
// REQUIRED for list items
export const ProtocolRow = React.memo(({ item, onPress }: ProtocolRowProps) => {
  return <TouchableOpacity onPress={onPress}>...</TouchableOpacity>;
});

// Missing memoization candidates:
// - HistoryItem (rendered in SectionList)
// - BalanceRow (rendered in FlatList)
```

## useMemo -- 169 occurrences across 73 files (GOOD)

Well-used for derived display values, theme configs, filter results, and style
objects.

**RULE: Wrap in useMemo when:**

1. Computing derived values from store data (filtered lists, formatted amounts)
2. Creating objects/arrays passed as props to memoized children
3. Computing style objects inside component bodies

```tsx
// REQUIRED — derived list
const visibleCollectibles = useMemo(
  () => collectibles.filter((c) => !c.isHidden),
  [collectibles],
);

// REQUIRED — style object
const trackStyle = useMemo(
  () => ({ backgroundColor: isChecked ? colors.active : colors.inactive }),
  [isChecked, colors],
);
```

## useCallback -- 331 occurrences across 85 files (GOOD)

Strong adoption. Used for event handlers, filter callbacks, modal handlers, and
renderItem.

**RULE: ALL callbacks passed to child components or used in FlatList MUST use
useCallback.**

```tsx
// REQUIRED — renderItem for FlatList
const renderItem = useCallback(
  ({ item }: { item: Operation }) => (
    <HistoryItem operation={item} onPress={handleDetails} />
  ),
  [handleDetails],
);

// REQUIRED — event handler passed as prop
const handleRefresh = useCallback(async () => {
  await fetchBalances(publicKey);
}, [fetchBalances, publicKey]);
```

## FlatList Optimization -- 23 FlatLists, 63 ScrollViews

Some FlatLists are well-optimized (TabOverview has `windowSize`,
`maxToRenderPerBatch`, `removeClippedSubviews`), but others are missing
performance props.

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
  getItemLayout={getItemLayout} // REQUIRED for fixed-height items
/>
```

**Missing optimization:** Some FlatList usages in the codebase are still missing
required performance props. Audit any FlatList to ensure it includes stable
`keyExtractor`, `windowSize`, `maxToRenderPerBatch`, and `removeClippedSubviews`
as applicable.

**RULE: Never use ScrollView for lists exceeding ~50 items. Use FlatList with
virtualization.**

## Zustand Selector Patterns -- CRITICAL GAP (Score: 2/10)

Current pattern destructures entire store, causing re-renders on ANY state
change:

```tsx
// ANTI-PATTERN — subscribes to entire store (current codebase pattern)
const { tabs, activeTabId, isTabActive } = useBrowserTabsStore();

// CORRECT — selective subscription, only re-renders when selected state changes
const tabs = useBrowserTabsStore((state) => state.tabs);
const activeTabId = useBrowserTabsStore((state) => state.activeTabId);
```

**RULE: Use Zustand selectors to subscribe ONLY to the state your component
needs. Never destructure the entire store.**

For multiple fields, use shallow comparison:

```tsx
import { useShallow } from "zustand/react/shallow";

const { tabs, activeTabId } = useBrowserTabsStore(
  useShallow((state) => ({ tabs: state.tabs, activeTabId: state.activeTabId })),
);
```

## Inline Functions in JSX -- 123 onPress inline, 110 inline styles

**RULE: Extract inline handlers to useCallback. Extract inline styles to useMemo
or constants.**

```tsx
// WRONG — 123 occurrences found
<ContactRow onPress={() => onContactPress(item.address)} />;

// CORRECT
const handlePress = useCallback(
  () => onContactPress(item.address),
  [onContactPress, item.address],
);
<ContactRow onPress={handlePress} />;
```

## Image Optimization -- Score: 4/10

No FastImage adoption despite availability. React Native's default Image has no
HTTP caching.

**RULE: Use FastImage for ALL remote images (token icons, NFTs, profile
images).**

```tsx
import FastImage from "@d11/react-native-fast-image";

<FastImage
  source={{ uri: tokenIconUrl }}
  style={{ width: 40, height: 40 }}
  resizeMode={FastImage.resizeMode.contain}
/>;
```

Always specify `resizeMode`. Implement loading placeholders with Animated
opacity fade (see `Token/index.tsx` for reference pattern).

## Reanimated Patterns -- 15 useAnimatedStyle, 6 useSharedValue (GOOD)

Well-implemented in Toggle, Token, and BottomNavigationBar components.

**RULE: Use Reanimated for animations that need 60fps. Keep animation logic in
useAnimatedStyle worklets. Never animate on the JS thread.**

```tsx
// CORRECT — runs on UI thread
const animatedStyle = useAnimatedStyle(() => ({
  opacity: withTiming(isVisible.value ? 1 : 0),
}));

// WRONG — runs on JS thread
const [opacity] = useState(new Animated.Value(0));
```

## useEffect Patterns -- 127 effects, 69 with cleanup (EXCELLENT)

**RULE: Every useEffect with subscriptions, timers, or listeners MUST return a
cleanup function.**

```tsx
useEffect(() => {
  const subscription = Keyboard.addListener("keyboardDidShow", handler);
  return () => subscription.remove(); // REQUIRED cleanup
}, []);
```

## Key Props -- 2 index-as-key anti-patterns

**RULE: Never use array index as key. Use stable unique identifiers.**

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

## Performance Priority Actions

| Priority | Action                                                 | Impact                                    | Score Impact |
| -------- | ------------------------------------------------------ | ----------------------------------------- | ------------ |
| **P0**   | Implement Zustand selective subscriptions              | Prevents re-renders across 85 files       | 2/10 → 8/10  |
| **P0**   | Add FlatList optimization props to all lists           | Improves scroll perf on 9 list components | 6/10 → 9/10  |
| **P1**   | Adopt FastImage for remote images                      | Adds HTTP caching for all images          | 4/10 → 8/10  |
| **P1**   | Extract 123 inline handlers to useCallback             | Stabilizes reference equality             | 6/10 → 8/10  |
| **P2**   | Memoize list item components (HistoryItem, BalanceRow) | Prevents unnecessary list item re-renders | 7/10 → 9/10  |
