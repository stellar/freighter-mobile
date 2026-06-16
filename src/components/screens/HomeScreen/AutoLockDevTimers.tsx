/* ===========================================================================
 * TODO / FIXME: TEMPORARY DEV-ONLY auto-lock countdown readout.
 * !!! REMOVE THIS FILE (and its usage in HomeScreen.tsx) BEFORE MERGING TO
 * PRODUCTION !!! Shows the live idle countdown (time until the foreground
 * auto-lock fires, resetting on interaction) and the countdown to the
 * hash-key hard expiry, so QA can watch the lock flows.
 * ===========================================================================
 */
import { Text } from "components/sds/Typography";
import { AUTO_LOCK_TIMER_MS } from "config/constants";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  getAutoLockTimer,
  getDevAutoLockTimerMs,
  getDevLastInteractionAt,
} from "services/autoLock";
import { getHashKey } from "services/storage/helpers";

const TICK_MS = 1000;
const NEVER_LABEL = "Never";
const BACKGROUND_ONLY_LABEL = "on background";
const EMPTY_LABEL = "—";

const formatSeconds = (ms: number): string =>
  `${Math.max(0, Math.ceil(ms / 1000))}s`;

export const AutoLockDevTimers: React.FC = () => {
  const [autoLockMs, setAutoLockMs] = useState<number | null>(null);
  const [hashExpiresAt, setHashExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let mounted = true;

    const read = async () => {
      const devMs = await getDevAutoLockTimerMs();
      const timer = await getAutoLockTimer();
      const hashKey = await getHashKey();
      if (!mounted) {
        return;
      }
      setAutoLockMs(devMs ?? AUTO_LOCK_TIMER_MS[timer]);
      setHashExpiresAt(hashKey?.expiresAt ?? null);
    };

    read();
    const id = setInterval(() => {
      setNow(Date.now());
      read();
    }, TICK_MS);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  // Idle countdown: time left until the foreground auto-lock fires, measured
  // from the last interaction. NONE never idle-locks; IMMEDIATELY is
  // background-only (no foreground countdown).
  let idleLabel: string;
  if (autoLockMs === null) {
    idleLabel = NEVER_LABEL;
  } else if (autoLockMs === 0) {
    idleLabel = BACKGROUND_ONLY_LABEL;
  } else {
    idleLabel = formatSeconds(autoLockMs - (now - getDevLastInteractionAt()));
  }

  const hashRemainingMs = hashExpiresAt === null ? null : hashExpiresAt - now;

  return (
    <View className="mt-1 items-center">
      <Text sm secondary>
        {`idle lock in: ${idleLabel}`}
      </Text>
      <Text sm secondary>
        {`hash expires in: ${
          hashRemainingMs === null
            ? EMPTY_LABEL
            : formatSeconds(hashRemainingMs)
        }`}
      </Text>
    </View>
  );
};

export default AutoLockDevTimers;
