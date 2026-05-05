# Styling

## Primary: NativeWind (TailwindCSS for React Native)

The primary styling approach uses NativeWind, which brings TailwindCSS utility
classes to React Native via the `className` prop:

```tsx
<View className="pt-8 w-full items-center flex-col gap-3">
  <Text className="text-lg font-bold text-white">Welcome</Text>
  <TouchableOpacity className="bg-primary rounded-lg px-6 py-3">
    <Text className="text-white text-center">Get Started</Text>
  </TouchableOpacity>
</View>
```

Use NativeWind for the majority of layout and styling needs.

## Complex Styled Components

For dynamic, prop-driven styling beyond what NativeWind handles cleanly, use
React Native `StyleSheet` with computed style objects. Do not introduce new
`styled-components/native` usage. Existing SDS primitives (`Button`,
`Typography`, `Token`, `Toast`, `Notification`) and layout wrappers
(`BaseLayout`, `OnboardLayout`, `ScrollableKeyboardView`) retain their
`styled-components` usage until a coordinated migration — do not refactor them
unless that migration is the explicit goal.

```tsx
import { StyleSheet, TouchableOpacity } from "react-native";

interface PrimaryButtonProps {
  variant: "primary" | "secondary";
  isDisabled?: boolean;
}

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  variant,
  isDisabled,
  children,
  onPress,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[
      styles.base,
      variant === "primary" ? styles.primary : styles.secondary,
      isDisabled && styles.disabled,
    ]}
  >
    {children}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  base: { borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  primary: { backgroundColor: "#5C63FF" },
  secondary: { backgroundColor: "transparent" },
  disabled: { opacity: 0.5 },
});
```

## Design System (SDS)

**RULE: Before writing any UI element, check `src/components/sds/` first. If an
SDS component covers the use case, use it — do not recreate it, do not reach for
the raw React Native primitive.**

Available SDS components:

- Buttons (`Button`, `TextButton`, `BiometricToggleButton`)
- Text / Typography (`Text`, `Display`)
- Inputs (`Input`, `Textarea`)
- Banners / Notices (`Banner`, `NoticeBanner`)
- Feedback (`Badge`, `Notification`, `Toast`)
- Controls (`Toggle`, `SegmentedControl`)
- Media (`Avatar`, `Token`, `Icon`)

Common violations to avoid:

```tsx
// WRONG — raw RN primitive when SDS covers it
<TouchableOpacity onPress={onPress}>
  <Text>Submit</Text>
</TouchableOpacity>

// CORRECT
<Button onPress={onPress}>Submit</Button>

// WRONG — raw Text with manual font/color styling
<Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
  Account Balance
</Text>

// CORRECT
<Text md semiBold secondary>Account Balance</Text>

// WRONG — custom inline badge
<View style={{ backgroundColor: "red", borderRadius: 12 }}>
  <Text>New</Text>
</View>

// CORRECT
<Badge variant="error">New</Badge>
```

Only build a custom component when the SDS has no equivalent. When you do,
follow the same prop-typing and variant patterns used in the SDS so it can be
promoted later.

## Bottom Sheets

Bottom sheets use `@gorhom/bottom-sheet` with the `BottomSheetModal` ref
pattern:

```tsx
import { BottomSheetModal } from "@gorhom/bottom-sheet";

const MyScreen: React.FC = () => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  const openSheet = () => bottomSheetRef.current?.present();
  const closeSheet = () => bottomSheetRef.current?.dismiss();

  return (
    <>
      <Button onPress={openSheet}>Open</Button>
      <BottomSheetModal ref={bottomSheetRef} snapPoints={["50%"]}>
        <SheetContent onClose={closeSheet} />
      </BottomSheetModal>
    </>
  );
};
```

Use the imperative `.present()` / `.dismiss()` methods via ref. Do not manage
bottom sheet visibility via state booleans.

## Modals

Use the custom `Modal` component (overlay-based), not React Native's built-in
`Modal`. The custom implementation provides consistent behavior across
platforms. Exception: `WalletConnectE2EHelper.tsx` uses React Native's built-in
`Modal` intentionally for Maestro e2e accessibility — this is a test-helper
carve-out, not a pattern to follow in production code.

## Platform-Specific Styling

Use `Platform.select()` or the `isIOS` / `isAndroid` helpers only when truly
needed for platform differences. Prefer cross-platform styles as the default:

```tsx
// Only when necessary
const containerStyle = Platform.select({
  ios: { paddingTop: 44 },
  android: { paddingTop: 24 },
});
```

## Responsive Design

- Test on small screens for both iOS and Android (this is a PR checklist
  requirement)
- Avoid fixed pixel heights that may clip on smaller devices
- Use flex-based layouts that adapt to available space

## Icons

Icons are SVG-based and imported as React components. In tests, SVGs are handled
via `svgMock` in the Jest configuration.

```tsx
import StarIcon from "assets/icons/star.svg";

<StarIcon width={24} height={24} fill="#FFFFFF" />;
```
