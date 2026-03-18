import { Button } from "components/sds/Button";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { Text } from "components/sds/Typography";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React from "react";
import { View } from "react-native";

/**
 * Props for the EditContactCard component.
 *
 * @property title - Header text displayed at the top of the card (e.g. "Add Contact" or "Edit Contact")
 * @property address - Current value of the Stellar address input
 * @property name - Current value of the contact name input
 * @property addressError - Validation error message for the address field, if any
 * @property nameError - Validation error message for the name field, if any
 * @property isValidating - Whether an async validation (e.g. federation resolution) is in progress
 * @property isSaveDisabled - Whether the save button should be disabled
 * @property onAddressChange - Called when the address input text changes
 * @property onNameChange - Called when the name input text changes
 * @property onAddressBlur - Called when the address input loses focus
 * @property onNameBlur - Called when the name input loses focus
 * @property onPaste - Called when the paste button is pressed
 * @property onSave - Called when the save button is pressed
 */
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
}

/**
 * Presentational card for adding or editing a Stellar contact.
 * Renders address and name inputs with validation errors, plus paste and save buttons.
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
}) => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  return (
    <View className="bg-background-primary rounded-3xl p-6 gap-8">
      <View className="gap-4">
        <Text lg medium>
          {title}
        </Text>
        <View className="gap-3">
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
            autoCapitalize="none"
            autoCorrect={false}
            error={addressError}
          />
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
          <Button xl secondary onPress={onPaste}>
            {t("contactBookScreen.paste")}
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
    </View>
  );
};

export default EditContactCard;
