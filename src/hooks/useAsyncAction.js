import { useCallback, useRef, useState } from 'react';

/**
 * Wraps an async function so the caller gets `{run, isLoading, error, reset}`.
 * Guarantees only one in-flight invocation at a time — duplicate `run()` calls
 * while a promise is pending are ignored. This prevents double-submits on
 * slow networks.
 */
export function useAsyncAction(fn) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args) => {
    if (inFlight.current) {
      return undefined;
    }

    inFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { run, isLoading, error, reset };
}
