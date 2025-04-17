import { debounce } from "lodash";
import { useEffect, useMemo, useRef } from "react";

/**
 * Debounce a callback function
 * @param callback - The callback function to debounce
 * @param delay - The delay in milliseconds
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
