import { xdr } from "@stellar/stellar-sdk";
import { Text } from "components/sds/Typography";
import {
  DisplayToken,
  scValToDisplayTokens,
  scValToDisplayValue,
} from "helpers/soroban";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useMemo } from "react";
import { Text as RNText, TextStyle } from "react-native";

/**
 * Above this many tokens the value renders as inert text.
 *
 * `args` comes from a dapp, so the size of a signed container is adversarial
 * input. A large map is one string today; as tokens it is one React element
 * per scalar, on the screen the user is about to approve from. Past the
 * threshold the literal still renders in full — only the per-scalar
 * interactivity is dropped.
 */
const MAX_INTERACTIVE_TOKENS = 1000;

/**
 * Thin spaces, so the badge reads as a chip. A nested `Text` cannot take
 * padding or a border radius — RN only applies text styles to it — so the
 * breathing room has to be part of the string.
 */
const BADGE_PAD = " ";

interface ScValDisplayProps {
  scVal: xdr.ScVal;
  /** Namespaces this value's token keys against its siblings. */
  tokenKeyPrefix: string;
  /** `${tokenKeyPrefix}:${index}` of the revealed token, or null. */
  revealedKey: string | null;
  onTokenPress: (key: string) => void;
  /** Identifies the whole rendered value; each scalar gets its own id below. */
  testID?: string;
}

/**
 * Renders a signed `SCVal` as its value literal, letting the signer tap any
 * scalar to see which `SCVal` arm it was signed as.
 *
 * The type is deliberately not spelled out inline. A Soroban struct is a
 * symbol-keyed map, so prefixing every entry with its type would bury the data
 * the signer is there to read: `{ amount: 100 }` stays `{ amount: 100 }`, and
 * the type is one tap away.
 *
 * The drawn text and the copied text are the same token stream
 * (`scValToDisplayTokens`), so they cannot drift apart.
 */
export const ScValDisplay: React.FC<ScValDisplayProps> = ({
  scVal,
  tokenKeyPrefix,
  revealedKey,
  onTokenPress,
  testID,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();
  const tokens = useMemo(() => scValToDisplayTokens(scVal), [scVal]);

  // Resolved once for the whole value rather than once per token: the SDS
  // `Text` subscribes to `Appearance` on every render, which is why the
  // scalars below are raw RN `Text` instead.
  //
  // A scalar carries no styling of its own. Colouring every tappable value
  // would repaint the literal to advertise an affordance, and the literal is
  // the thing the signer is here to read -- only the one being inspected is
  // marked, and only while it is being inspected.
  const styles = useMemo(
    () => ({
      revealed: {
        backgroundColor: themeColors.lilac[3],
      } as TextStyle,
      badge: {
        color: themeColors.lilac[11],
        backgroundColor: themeColors.lilac[3],
      } as TextStyle,
    }),
    [themeColors],
  );

  if (tokens.length > MAX_INTERACTIVE_TOKENS) {
    return (
      <Text testID={testID ?? `ScValDisplay-${tokenKeyPrefix}`}>
        {scValToDisplayValue(scVal)}
      </Text>
    );
  }

  return (
    <Text
      // The whole literal stays one accessible node, so a screen reader reads
      // it through as one value rather than as a run of buttons.
      accessibilityLabel={scValToDisplayValue(scVal)}
      testID={testID ?? `ScValDisplay-${tokenKeyPrefix}`}
    >
      {tokens.map((token: DisplayToken, index: number) => {
        const key = `${tokenKeyPrefix}:${index}`;

        if (token.kind === "punct") {
          return (
            <React.Fragment key={`${key}-punct`}>{token.text}</React.Fragment>
          );
        }

        const isRevealed = revealedKey === key;

        return (
          <React.Fragment key={`${key}-value`}>
            <RNText
              onPress={() => onTokenPress(key)}
              accessibilityRole="button"
              accessibilityLabel={`${token.text}, ${t(
                "signTransactionDetails.operations.type",
              )} ${token.scValType}`}
              style={isRevealed ? styles.revealed : undefined}
              testID={`ScValToken-${key}`}
            >
              {token.text}
            </RNText>
            {isRevealed && (
              <RNText style={styles.badge} testID={`ScValTokenType-${key}`}>
                {` ${BADGE_PAD}${token.scValType}${BADGE_PAD}`}
              </RNText>
            )}
          </React.Fragment>
        );
      })}
    </Text>
  );
};
