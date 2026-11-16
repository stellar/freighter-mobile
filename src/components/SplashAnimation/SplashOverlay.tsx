import { SplashAnimation } from "components/SplashAnimation/SplashAnimation";
import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

const styles = StyleSheet.create({
  flex: { flex: 1 },
});

interface SplashOverlayProps {
  /** True once the app has initialised; passed through to the animation. */
  ready: boolean;
  /** Called once, when the splash has finished and uncovered the app. */
  onFinished?: () => void;
  children: React.ReactNode;
}

/**
 * Plays the launch splash over the app rather than in its place, so the app
 * can mount underneath as soon as it is ready and the fade-out uncovers a
 * screen that is already drawn.
 *
 * That leaves the app live beneath the splash. The splash blocks touches, but
 * a screen reader walks the accessibility tree directly and would otherwise
 * read and activate the app through it, so the app is hidden from assistive
 * technology until the splash has gone (Android: no-hide-descendants; iOS:
 * accessibilityElementsHidden).
 */
export const SplashOverlay: React.FC<SplashOverlayProps> = ({
  ready,
  onFinished,
  children,
}) => {
  const [finished, setFinished] = useState(false);
  const hasFinished = useRef(false);

  const handleFinished = useCallback(() => {
    if (hasFinished.current) {
      return;
    }
    hasFinished.current = true;
    setFinished(true);
    onFinished?.();
  }, [onFinished]);

  return (
    <View style={styles.flex}>
      <View
        style={styles.flex}
        importantForAccessibility={finished ? "auto" : "no-hide-descendants"}
        accessibilityElementsHidden={!finished}
      >
        {children}
      </View>
      {!finished && (
        <SplashAnimation ready={ready} onFinished={handleFinished} />
      )}
    </View>
  );
};
