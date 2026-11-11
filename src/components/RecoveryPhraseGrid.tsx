import { BlurView } from "@react-native-community/blur";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { DEFAULT_COLOR_SCHEME } from "config/theme";
import { androidApiLevel, isIOS } from "helpers/device";
import { pxValue } from "helpers/dimensions";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { StyleSheet, View, useColorScheme } from "react-native";

/** Words per row; Figma lays the phrase out row by row, 1 and 2 first. */
const COLUMNS = 2;

/**
 * What stands in for the words while the phrase is hidden: a bar per word,
 * as long as the words of Figma's sample phrase, so the frost shows a phrase
 * behind it (?node-id=2543-152775). The hidden grid never holds the phrase,
 * so a screen reader can't read it through the frost, and nothing behind it
 * can be copied down, even where there's no live blur.
 */
const HIDDEN_WORD_LENGTHS = [5, 7, 5, 8, 6, 7, 5, 8, 7, 6, 6, 5];
/** About an Inter SemiBold 16 letter, and its x-height. */
const PLACEHOLDER_LETTER_WIDTH = 9;
const PLACEHOLDER_HEIGHT = 12;
const PLACEHOLDER_RADIUS = 4;

/**
 * The frost over the hidden grid. Figma: a 7.5pt backdrop blur under a 74%
 * fill (light ?node-id=1-11955, dark ?node-id=2543-152775).
 *
 * - iOS blurs what's behind with the scheme's blur style. That style brings
 *   a tint of its own, so the fill laid over it (`overBlur`) is lighter than
 *   Figma's: together they measure like Figma's frost on the iPhone 17 Pro
 *   simulator (dark: luminance 24, words up to 38, against Figma's 22 and
 *   36; light: 244 with words down to 235, against 244 and 237).
 * - Android can't blur what's behind a view, but from Android 12 it can blur
 *   a view's own content, and the placeholders are all the frost covers. So
 *   it blurs them as Figma's code export writes the frost, blur(7.5px), under
 *   Figma's fill, `surface`.
 * - `surface` alone stands in where there's no blur at all: Android before
 *   12, and iOS with Reduce Transparency.
 */
export const HIDDEN_PHRASE_FROST = {
  light: {
    blurType: "light",
    blurAmount: 8,
    overBlur: "rgba(243, 243, 243, 0.8)",
    surface: "rgba(243, 243, 243, 0.74)",
  },
  dark: {
    blurType: "dark",
    blurAmount: 8,
    overBlur: "rgba(20, 20, 20, 0.5)",
    surface: "rgba(20, 20, 20, 0.74)",
  },
} as const;

const ANDROID_PLACEHOLDER_BLUR = 7.5;
/** Android 12, from which `filter: blur` takes effect. */
const ANDROID_BLUR_MIN_API_LEVEL = 31;

const EYE_BUTTON_SIZE = 40;
const EYE_ICON_SIZE = 16;
const EYE_STROKE_WIDTH = 2;

interface RecoveryPhraseGridProps {
  /**
   * The phrase's words, in order. Leave it out for the hidden state, which
   * never receives the phrase.
   */
  words?: string[];
  testID?: string;
}

type PhraseCell =
  | { number: number; word: string }
  | { number: number; placeholderLength: number };

const PhraseWord: React.FC<{ cell: PhraseCell }> = ({ cell }) => {
  const { themeColors } = useColors();

  return (
    <View
      testID={`recovery-phrase-word-${cell.number}`}
      className="flex-1 flex-row gap-[8px] rounded-[12px] px-[12px] py-[8px]"
      style={{ backgroundColor: themeColors.background.secondary }}
    >
      <View className="w-[20px]">
        <Text md semiBold color={themeColors.gray[9]}>
          {cell.number}
        </Text>
      </View>
      <View className="flex-1">
        {"word" in cell ? (
          // Wraps rather than truncates: under large accessibility text, a
          // cut-off word would be written down wrong.
          <Text md semiBold primary>
            {cell.word}
          </Text>
        ) : (
          // A blank line of the word's text holds the row at a word's
          // height, which scales with the screen and the system's text size,
          // so revealing the phrase doesn't move what's below it.
          <View>
            <Text
              md
              semiBold
              testID={`recovery-phrase-placeholder-${cell.number}-line`}
            >
              {" "}
            </Text>
            <View style={StyleSheet.absoluteFill} className="justify-center">
              <View
                testID={`recovery-phrase-placeholder-${cell.number}`}
                style={{
                  width: pxValue(
                    cell.placeholderLength * PLACEHOLDER_LETTER_WIDTH,
                  ),
                  height: pxValue(PLACEHOLDER_HEIGHT),
                  borderRadius: pxValue(PLACEHOLDER_RADIUS),
                  backgroundColor: themeColors.text.primary,
                }}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

/**
 * The recovery phrase as Figma lays it out: numbered pills, two per row
 * (?node-id=1-11962). Without `words`, the hidden state: placeholders under
 * a frost with a slashed eye, read to screen readers as "Recovery phrase
 * hidden".
 */
export const RecoveryPhraseGrid: React.FC<RecoveryPhraseGridProps> = ({
  words,
  testID = "recovery-phrase-container",
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const frost = HIDDEN_PHRASE_FROST[useColorScheme() ?? DEFAULT_COLOR_SCHEME];
  const isHidden = !words;
  const blursPlaceholders =
    isHidden && !isIOS && androidApiLevel >= ANDROID_BLUR_MIN_API_LEVEL;

  const cells: PhraseCell[] = words
    ? words.map((word, index) => ({ number: index + 1, word }))
    : HIDDEN_WORD_LENGTHS.map((placeholderLength, index) => ({
        number: index + 1,
        placeholderLength,
      }));
  const rows = Array.from(
    { length: Math.ceil(cells.length / COLUMNS) },
    (_, row) => cells.slice(row * COLUMNS, (row + 1) * COLUMNS),
  );

  return (
    <View
      testID={testID}
      className="self-stretch"
      // Hidden, the grid reads as one element; revealed, word by word.
      accessible={isHidden}
      accessibilityLabel={
        isHidden
          ? t("recoveryPhraseScreen.hiddenPhraseAccessibilityLabel")
          : undefined
      }
    >
      <View
        testID={`${testID}-rows`}
        className="gap-[12px]"
        style={
          blursPlaceholders
            ? { filter: [{ blur: ANDROID_PLACEHOLDER_BLUR }] }
            : undefined
        }
      >
        {rows.map((row) => (
          <View key={row[0].number} className="flex-row gap-[16px]">
            {row.map((cell) => (
              <PhraseWord key={cell.number} cell={cell} />
            ))}
          </View>
        ))}
      </View>
      {isHidden && (
        <View
          testID={`${testID}-frost`}
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center overflow-hidden rounded-[16px]"
        >
          {isIOS && (
            <BlurView
              blurType={frost.blurType}
              blurAmount={frost.blurAmount}
              reducedTransparencyFallbackColor={frost.surface}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View
            testID={`${testID}-frost-fill`}
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isIOS ? frost.overBlur : frost.surface },
            ]}
          />
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: EYE_BUTTON_SIZE,
              height: EYE_BUTTON_SIZE,
              borderWidth: 1,
              borderColor: themeColors.text.secondary,
            }}
          >
            <Icon.EyeOff
              size={EYE_ICON_SIZE}
              strokeWidth={EYE_STROKE_WIDTH}
              color={themeColors.text.secondary}
            />
          </View>
        </View>
      )}
    </View>
  );
};
