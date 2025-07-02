import { createSignal } from "solid-js";
import { ZdepthApi } from "zdepth-wasm";

export function useZDepth() {
  const [isInitialized, setIsInitialized] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const api = new ZdepthApi();

  const initialize = async () => {
    if (isInitialized()) return;

    try {
      await api.init();
      setIsInitialized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Initialization failed");
    }
  };

  const compress = async (
    width: number,
    height: number,
    depthData: Uint16Array,
    keyframe = true
  ) => {
    if (!isInitialized()) {
      await initialize();
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.compress(width, height, depthData, keyframe);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Compression failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const decompress = async (compressedData: Uint8Array) => {
    if (!isInitialized()) {
      await initialize();
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.decompress(compressedData);
      return result;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Decompression failed";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isInitialized,
    isLoading,
    error,
    initialize,
    compress,
    decompress,
  };
}
