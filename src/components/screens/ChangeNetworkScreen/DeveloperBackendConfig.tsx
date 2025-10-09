import Icon from "components/sds/Icon";
import SegmentedControl from "components/sds/SegmentedControl";
import { Text } from "components/sds/Typography";
import {
  BackendEnvironment,
  getBackendV1Environment,
  getBackendV2Environment,
  setBackendV1Environment,
  setBackendV2Environment,
} from "config/backendConfig";
import useAppTranslation from "hooks/useAppTranslation";
import useColors from "hooks/useColors";
import React, { useEffect, useState } from "react";
import { View } from "react-native";

/**
 * Developer Backend Configuration Component
 *
 * Allows devs and QA members to switch between PROD, STG, and DEV backend environments
 * for both Backend V1 and V2. Only visible in "Freighter Dev" builds.
 *
 * Backend selections are persisted in AsyncStorage and take effect after app restart.
 */
const DeveloperBackendConfig: React.FC = () => {
  const { t } = useAppTranslation();
  const { themeColors } = useColors();

  const [backendV1Env, setBackendV1Env] = useState<BackendEnvironment>(
    BackendEnvironment.DEV,
  );
  const [backendV2Env, setBackendV2Env] = useState<BackendEnvironment>(
    BackendEnvironment.DEV,
  );

  // Load saved backend environments on mount
  useEffect(() => {
    const loadBackendEnvironments = async () => {
      const v1Env = await getBackendV1Environment();
      const v2Env = await getBackendV2Environment();
      setBackendV1Env(v1Env);
      setBackendV2Env(v2Env);
    };

    loadBackendEnvironments();
  }, []);

  const handleSetBackendV1Environment = (env: BackendEnvironment) => {
    setBackendV1Env(env);
    setBackendV1Environment(env);
  };

  const handleSetBackendV2Environment = (env: BackendEnvironment) => {
    setBackendV2Env(env);
    setBackendV2Environment(env);
  };

  const backendEnvironmentOptions = [
    { label: "PROD", value: BackendEnvironment.PROD },
    { label: "STG", value: BackendEnvironment.STG },
    { label: "DEV", value: BackendEnvironment.DEV },
  ];

  return (
    <View className="flex flex-col gap-1 p-4 rounded-[12px] bg-background-secondary">
      <View className="flex flex-row items-center gap-2 mb-2">
        <Icon.AlertTriangle themeColor="amber" />
        <Text sm semiBold color={themeColors.status.warning}>
          {t("changeNetworkScreen.developerSettings.title")}
        </Text>
      </View>
      <Text xs color={themeColors.status.warning}>
        {t("changeNetworkScreen.developerSettings.warning")}
      </Text>

      <View className="flex flex-col gap-2 mt-5">
        <Text secondary sm medium>
          {t("changeNetworkScreen.developerSettings.backendV1Environment")}
        </Text>
        <SegmentedControl
          options={backendEnvironmentOptions}
          selectedValue={backendV1Env}
          onValueChange={(value) =>
            handleSetBackendV1Environment(value as BackendEnvironment)
          }
        />
      </View>

      <View className="flex flex-col gap-2 mt-3">
        <Text secondary sm medium>
          {t("changeNetworkScreen.developerSettings.backendV2Environment")}
        </Text>
        <SegmentedControl
          options={backendEnvironmentOptions}
          selectedValue={backendV2Env}
          onValueChange={(value) =>
            handleSetBackendV2Environment(value as BackendEnvironment)
          }
        />
      </View>
    </View>
  );
};

export default DeveloperBackendConfig;
