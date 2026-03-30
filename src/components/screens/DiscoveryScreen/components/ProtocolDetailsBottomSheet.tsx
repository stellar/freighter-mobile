import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import { App } from "components/sds/App";
import { Badge } from "components/sds/Badge";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Text } from "components/sds/Typography";
import { getDisplayHost } from "helpers/protocols";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback } from "react";
import { View } from "react-native";

interface ProtocolDetails {
  name: string;
  iconUrl: string;
  websiteUrl: string;
  description: string;
  tags: string[];
}

interface ProtocolDetailsBottomSheetProps {
  protocol: ProtocolDetails | null;
  modalRef: React.RefObject<BottomSheetModal | null>;
  onOpen: (url: string) => void;
}

const ProtocolDetailsBottomSheet: React.FC<ProtocolDetailsBottomSheetProps> =
  React.memo(({ protocol, modalRef, onOpen }) => {
    const { t } = useAppTranslation();
    const { themeColors } = useColors();

    const handleClose = useCallback(() => {
      modalRef.current?.dismiss();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleOpen = useCallback(() => {
      if (protocol) {
        const { websiteUrl } = protocol;
        handleClose();
        // Defer navigation slightly so the dismiss animation can start
        // before the full state change from onOpen triggers a re-render.
        requestAnimationFrame(() => onOpen(websiteUrl));
      }
    }, [protocol, onOpen, handleClose]);

    const domain = protocol ? getDisplayHost(protocol.websiteUrl) : null;

    const content = (() => {
      if (!protocol) return null;

      return (
        <View className="gap-6">
          <View className="flex-row items-center">
            <App appName={protocol.name} favicon={protocol.iconUrl} size="xl" />
            <View className="flex-1 ml-3 mr-3">
              <Text xl medium numberOfLines={1}>
                {protocol.name}
              </Text>
            </View>
            <Button tertiary lg onPress={handleOpen}>
              {t("discovery.open")}
            </Button>
          </View>

          {domain && (
            <View className="gap-2">
              <Text sm secondary>
                {t("discovery.domain")}
              </Text>
              <View className="flex-row items-center gap-2">
                <Icon.Globe01 size={16} color={themeColors.text.secondary} />
                <Text md>{domain}</Text>
              </View>
            </View>
          )}

          {protocol.tags.length > 0 && (
            <View className="gap-2">
              <Text sm secondary>
                {t("discovery.tags")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {protocol.tags.map((tag) => (
                  <Badge key={tag} variant="success" size="lg">
                    {tag}
                  </Badge>
                ))}
              </View>
            </View>
          )}

          {protocol.description && (
            <View className="gap-2">
              <Text sm secondary>
                {t("discovery.description")}
              </Text>
              <Text md>{protocol.description}</Text>
            </View>
          )}
        </View>
      );
    })();

    return (
      <BottomSheet
        modalRef={modalRef}
        customContent={content}
        handleCloseModal={handleClose}
        enableDynamicSizing
      />
    );
  });

ProtocolDetailsBottomSheet.displayName = "ProtocolDetailsBottomSheet";

export default ProtocolDetailsBottomSheet;
