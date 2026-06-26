/** Wrap fetch with a hard deadline so hung TLS/connect does not block for minutes. */
export function fetchWithDeadline(fetchImpl: typeof fetch, timeoutMs: number): typeof fetch {
  const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 12_000;
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}
