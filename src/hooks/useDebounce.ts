import { debounce } from "lodash";
import { useEffect, useMemo, useRef } from "react";

export default function useDebounce(callback: () => void, delay: number) {
  const ref = useRef<() => void>(callback);

  useEffect(() => {
    ref.current = callback;
  }, [callback]);

  const debouncedCallback = useMemo(() => {
    const func = () => {
      ref.current?.();
    };

    return debounce(func, delay);
  }, [delay]);

  return debouncedCallback;
}
