import { DEFAULT_DEBOUNCE_DELAY } from "config/constants";
import { debounce, DebouncedFunc } from "lodash";
import { useEffect, useMemo, useRef } from "react";

/**
 * Debounce a callback function
 * @param callback - The callback function to debounce
 * @param delay - The delay in milliseconds. If not provided, the default delay is 500ms.
 * @returns The debounced callback function
 * @example
 * const Input = () => {
 *  const [value, setValue] = useState();
 *
  const debouncedRequest = useDebounce(() => {
    // send request to the backend
    // access to latest state here
    console.log(value);
  });

  const onChange = (e) => {
    const value = e.target.value;
    setValue(value);

    debouncedRequest();
  };

  return <Input onChange={onChange} value={value} />;
 * }
 */
export default function useDebounce<Args extends unknown[], R>(
  callback: (...args: Args) => R,
  delay: number = DEFAULT_DEBOUNCE_DELAY,
): DebouncedFunc<(...args: Args) => R> {
  const callbackRef = useRef(callback);

  // Keep the latest callback in ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create the debounced function
  const debounced = useMemo(() => {
    const debouncedFunc = (...args: Args) => {
      callbackRef.current(...args);
    };
    return debounce(debouncedFunc, delay) as DebouncedFunc<
      (...args: Args) => R
    >;
  }, [delay]);

  // Cleanup on unmount
  useEffect(() => () => debounced.cancel(), [debounced]);

  return debounced;
}
