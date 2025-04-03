import { BaseLayout } from "components/layout/BaseLayout";
import Icon from "components/sds/Icon";
import { Input } from "components/sds/Input";
import { THEME } from "config/theme";
import { pxValue } from "helpers/dimensions";
import React, { useState } from "react";

const ManageAssetsScreen: React.FC = () => {
  const [search, setSearch] = useState("");

  return (
    <BaseLayout
      useKeyboardAvoidingView
      insets={{ bottom: false, left: true, right: true, top: false }}
    >
      <Input
        placeholder="Search token name or address with a "
        value={search}
        onChangeText={setSearch}
        fieldSize="lg"
        leftElement={
          <Icon.SearchMd
            size={pxValue(16)}
            color={THEME.colors.foreground.primary}
          />
        }
      />
    </BaseLayout>
  );
};

export default ManageAssetsScreen;
