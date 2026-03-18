import { BottomSheetModal } from "@gorhom/bottom-sheet";
import BottomSheet from "components/BottomSheet";
import InformationBottomSheet from "components/InformationBottomSheet";
import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useCallback, useRef } from "react";
import { Keyboard, TouchableOpacity, View } from "react-native";

interface EditContactCardProps {
  title: string;
  address: string;
  name: string;
  addressError?: string;
  nameError?: string;
  isValidating: boolean;
  isSaveDisabled: boolean;
  onAddressChange: (text: string) => void;
  onNameChange: (text: string) => void;
  onAddressBlur: () => void;
  onNameBlur: () => void;
  onPaste: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Card component for adding or editing a Stellar contact.
 * Designed to be rendered inside a BottomSheet.
 * Includes info bottom sheets for field labels.
 * All state and logic are managed externally via props (see {@link useEditContactCard}).
 */
const EditContactCard: React.FC<EditContactCardProps> = ({
  title,
  address,
  name,
  addressError,
  nameError,
  isValidating,
  isSaveDisabled,
  onAddressChange,
  onNameChange,
  onAddressBlur,
  onNameBlur,
  onPaste,
  onSave,
  onCancel,
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const addressInfoRef = useRef<BottomSheetModal>(null);
  const nameInfoRef = useRef<BottomSheetModal>(null);

  const handleCloseAddressInfo = useCallback(() => {
    addressInfoRef.current?.dismiss();
  }, []);

  const handleCloseNameInfo = useCallback(() => {
    nameInfoRef.current?.dismiss();
  }, []);

  return (
    <View className="gap-6">
      <View className="flex-row items-center justify-center">
        <TouchableOpacity
          onPress={onCancel}
          className="absolute left-0"
          hitSlop={8}
          testID="close-button"
        >
          <Icon.X size={24} color={themeColors.text.primary} />
        </TouchableOpacity>
        <Text md semiBold>
          {title}
        </Text>
      </View>

      <View className="gap-6">
        <View className="gap-2">
          <View className="flex-row items-center gap-1">
            <Text sm medium secondary>
              {t("contactBookScreen.addressLabel")}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                addressInfoRef.current?.present();
              }}
              hitSlop={8}
            >
              <Icon.InfoCircle themeColor="gray" size={16} />
            </TouchableOpacity>
          </View>
          <Input
            fieldSize="lg"
            value={address}
            onChangeText={onAddressChange}
            onBlur={onAddressBlur}
            placeholder={t("contactBookScreen.addressPlaceholder")}
            leftElement={
              <Icon.Wallet01
                size={16}
                color={themeColors.foreground.secondary}
              />
            }
            endButton={{
              content: (
                <View className="flex-row items-center gap-1">
                  <Icon.Clipboard size={16} color={themeColors.text.primary} />
                  <Text sm semiBold>
                    {t("contactBookScreen.paste")}
                  </Text>
                </View>
              ),
              onPress: () => {
                onPaste();
              },
            }}
            autoCapitalize="none"
            autoCorrect={false}
            error={addressError}
          />
        </View>
        <View className="gap-2">
          <View className="flex-row items-center gap-1">
            <Text sm medium secondary>
              {t("contactBookScreen.nameLabel")}
            </Text>
            <TouchableOpacity
              onPress={() => {
                Keyboard.dismiss();
                nameInfoRef.current?.present();
              }}
              hitSlop={8}
            >
              <Icon.InfoCircle themeColor="gray" size={16} />
            </TouchableOpacity>
          </View>
          <Input
            fieldSize="lg"
            value={name}
            onChangeText={onNameChange}
            onBlur={onNameBlur}
            placeholder={t("contactBookScreen.namePlaceholder")}
            leftElement={
              <Icon.User01 size={16} color={themeColors.foreground.secondary} />
            }
            autoCorrect={false}
            error={nameError}
          />
        </View>
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button xl secondary onPress={onCancel}>
            {t("contactBookScreen.cancel")}
          </Button>
        </View>
        <View className="flex-1">
          <Button
            xl
            primary
            onPress={onSave}
            isLoading={isValidating}
            disabled={isSaveDisabled}
            testID="save-button"
          >
            {t("contactBookScreen.save")}
          </Button>
        </View>
      </View>

      <BottomSheet
        modalRef={addressInfoRef}
        handleCloseModal={handleCloseAddressInfo}
        customContent={
          <InformationBottomSheet
            title={t("contactBookScreen.addressInfo.title")}
            onClose={handleCloseAddressInfo}
            headerElement={
              <View className="bg-lilac-3 p-2 rounded-[8px]">
                <Icon.Wallet01 color={themeColors.lilac[9]} size={28} />
              </View>
            }
            texts={[
              {
                key: "description",
                value: t("contactBookScreen.addressInfo.description"),
              },
            ]}
          />
        }
      />

      <BottomSheet
        modalRef={nameInfoRef}
        handleCloseModal={handleCloseNameInfo}
        customContent={
          <InformationBottomSheet
            title={t("contactBookScreen.nameInfo.title")}
            onClose={handleCloseNameInfo}
            headerElement={
              <View className="bg-lilac-3 p-2 rounded-[8px]">
                <Icon.User01 color={themeColors.lilac[9]} size={28} />
              </View>
            }
            texts={[
              {
                key: "description",
                value: t("contactBookScreen.nameInfo.description"),
              },
            ]}
          />
        }
      />
    </View>
  );
};

export default EditContactCard;
