import { Text, TextProps } from "components/sds/Typography";
import { THEME } from "config/theme";
import { parseLinkedText } from "helpers/linkedText";
import React from "react";

interface LinkedTextProps extends Omit<TextProps, "children" | "url"> {
  children: string;
}

/**
 * Renders text while turning markdown-style `[text](https://...)` links and
 * bare `https://` URLs into tappable links, opened via the existing `Text`
 * `url` prop (in-app browser). Everything else renders as plain text - no
 * other markdown/HTML is parsed, so this is safe to use directly on
 * untrusted/external strings (e.g. API responses).
 *
 * Drop-in replacement for `<Text>` wherever the text content may contain a
 * link, e.g. `<LinkedText md>{protocol.description}</LinkedText>`.
 */
export const LinkedText: React.FC<LinkedTextProps> = ({
  children,
  ...textProps
}) => (
  <Text {...textProps}>
    {parseLinkedText(children).map((segment, index) =>
      segment.url ? (
        <Text
          key={`${index}-${segment.url}`}
          {...textProps}
          color={THEME.colors.primary}
          url={segment.url}
          accessibilityRole="link"
        >
          {segment.text}
        </Text>
      ) : (
        // eslint-disable-next-line react/no-array-index-key
        <React.Fragment key={`${index}-text`}>{segment.text}</React.Fragment>
      ),
    )}
  </Text>
);
