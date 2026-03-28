import Modal from "components/Modal";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { THEME } from "config/theme";
import useAppTranslation from "hooks/useAppTranslation";
import React from "react";
import { View } from "react-native";

interface DiscoverWelcomeModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const DiscoverWelcomeModal: React.FC<DiscoverWelcomeModalProps> = React.memo(
  ({ visible, onDismiss }) => {
    const { t } = useAppTranslation();

    return (
      <Modal visible={visible} onClose={onDismiss} closeOnOverlayPress>
        <View className="gap-7">
          <View className="gap-5">
            <View className="size-[40px] rounded-[8px] bg-lilac-3 border border-lilac-6 items-center justify-center">
              <Icon.Compass03 size={25} color={THEME.colors.primary} />
            </View>

            <View className="gap-5">
              <Text xl medium>
                {t("discovery.welcomeTitle")}
              </Text>

              <Text md medium secondary>
                {t("discovery.welcomeGateway")}
              </Text>

              <Text md medium secondary>
                {t("discovery.legalDisclaimer")}
              </Text>
            </View>
          </View>

          <Button tertiary isFullWidth onPress={onDismiss}>
            {t("discovery.welcomeCta")}
          </Button>
        </View>
      </Modal>
    );
  },
);

DiscoverWelcomeModal.displayName = "DiscoverWelcomeModal";

export default DiscoverWelcomeModal;
