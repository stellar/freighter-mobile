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

For components with dynamic, prop-driven styling that goes beyond what utility
classes handle cleanly, use `styled-components/native` with typed props:

```tsx
import styled from "styled-components/native";

interface StyledButtonProps {
  variant: "primary" | "secondary";
  isDisabled?: boolean;
}

const StyledButton = styled(TouchableOpacity)<StyledButtonProps>`
  background-color: ${({ variant }) =>
    variant === "primary" ? "#5C63FF" : "transparent"};
  opacity: ${({ isDisabled }) => (isDisabled ? 0.5 : 1)};
  border-radius: 8px;
  padding: 12px 24px;
`;
```

## Design System (SDS)

The Stellar Design System components live in `src/components/sds/` and provide
typed component variants for common UI elements:

- Buttons
- Text / Typography
- Cards
- Inputs
- And more

**Always check SDS first** before creating custom styled components. Use SDS
components as the foundation and extend only when necessary.

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
      <Button onPress={openSheet} title="Open" />
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
platforms.

## Platform-Specific Styling

Use `Platform.select()` or `Platform.OS` checks only when truly needed for
platform differences. Prefer cross-platform styles as the default:

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
