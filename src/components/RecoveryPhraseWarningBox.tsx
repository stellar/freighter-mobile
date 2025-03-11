import Icon from "components/sds/Icon";
import { Text, TextProps } from "components/sds/Typography";
import { PALETTE, THEME } from "config/theme";
import { fs, px } from "helpers/dimensions";
import React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components/native";

const Container = styled.View`
  background-color: ${THEME.colors.background.tertiary};
  padding: ${px(24)};
  border-radius: 16px;
  gap: ${px(16)};
  width: 100%;
`;

const ItemBox = styled.View`
  border-radius: 8px;
  flex-direction: row;
  align-items: flex-start;
`;

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
const ItemText = styled(Text).attrs((props: TextProps) => ({
  size: "sm",
  weight: "semiBold",
  includeFontPadding: false,
  ...props,
}))`
  flex: 1;
  margin-left: ${px(16)};
  line-height: ${fs(20)};
`;

export interface RecoveryPhraseWarningBoxProps {
  testID?: string;
}

const RecoveryPhraseWarningBox: React.FC<RecoveryPhraseWarningBoxProps> = ({
  testID,
}) => {
  const { t } = useTranslation();

  const iconProps = {
    size: 20,
    color: PALETTE.dark.gray["09"],
  };

  return (
    <Container testID={testID || "recovery-phrase-warning-box"}>
      <ItemBox testID="recovery-phrase-warning-item-1">
        <Icon.Lock01 {...iconProps} />
        <ItemText testID="recovery-phrase-warning-text-1">
          {t("recoveryPhraseWarning.yourRecoveryPhrase")}
        </ItemText>
      </ItemBox>
      <ItemBox testID="recovery-phrase-warning-item-2">
        <Icon.PasscodeLock {...iconProps} />
        <ItemText testID="recovery-phrase-warning-text-2">
          {t("recoveryPhraseWarning.ifYouForgetYourPassword")}
        </ItemText>
      </ItemBox>
      <ItemBox testID="recovery-phrase-warning-item-3">
        <Icon.EyeOff {...iconProps} />
        <ItemText testID="recovery-phrase-warning-text-3">
          {t("recoveryPhraseWarning.dontShareWithAnyone")}
        </ItemText>
      </ItemBox>
      <ItemBox testID="recovery-phrase-warning-item-4">
        <Icon.XSquare {...iconProps} />
        <ItemText testID="recovery-phrase-warning-text-4">
          {t("recoveryPhraseWarning.neverAskForYourPhrase")}
        </ItemText>
      </ItemBox>
      <ItemBox testID="recovery-phrase-warning-item-5">
        <Icon.AlertCircle {...iconProps} />
        <ItemText testID="recovery-phrase-warning-text-5">
          {t("recoveryPhraseWarning.ifYouLose")}
        </ItemText>
      </ItemBox>
    </Container>
  );
};

export default RecoveryPhraseWarningBox;
