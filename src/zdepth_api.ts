import ZdepthModuleFactory, {
  MainModule as EmscriptenModule,
  DepthCompressor as EmbindDepthCompressor,
} from "../build/wasm_modules/ZdepthModule";

export enum DepthResult {
  Success = 0,
  FileTruncated = 1,
  WrongFormat = 2,
  Corrupted = 3,
  MissingPFrame = 4,
  BadDimensions = 5,
}

export class ZdepthWASMError extends Error {
  constructor(message: string, public code?: DepthResult) {
    super(message);
    this.name = "ZdepthWASMError";
    Object.setPrototypeOf(this, ZdepthWASMError.prototype);
  }
}

function getDepthResultErrorMessage(resultCode: number): string {
  switch (resultCode) {
    case DepthResult.FileTruncated:
      return "File truncated. Data is incomplete.";
    case DepthResult.WrongFormat:
      return "Wrong format. Not a recognized depth frame.";
    case DepthResult.Corrupted:
      return "Corrupted data. Data integrity check failed.";
    case DepthResult.MissingPFrame:
      return "Missing P-frame. Cannot decompress non-keyframe without previous frame.";
    case DepthResult.BadDimensions:
      return "Bad dimensions. Image width/height are not multiples of block size (e.g., 32).";
    case DepthResult.Success:
      return "Operation successful."; // Should not trigger an error throw
    default:
      return `An unknown error occurred with code: ${resultCode}.`;
  }
}

// Utility functions to convert between JS arrays and Emscripten vectors
function toVectorUint16(module: any, arr: Uint16Array): any {
  const vec = new module.VectorUint16();
  for (let i = 0; i < arr.length; ++i) {
    vec.push_back(arr[i]);
  }
  return vec;
}

function fromVectorUint16(vec: any): Uint16Array {
  const arr = new Uint16Array(vec.size());
  for (let i = 0; i < arr.length; ++i) {
    arr[i] = vec.get(i);
  }
  return arr;
}

function toVectorUint8(module: any, arr: Uint8Array): any {
  const vec = new module.VectorUint8();
  for (let i = 0; i < arr.length; ++i) {
    vec.push_back(arr[i]);
  }
  return vec;
}

function fromVectorUint8(vec: any): Uint8Array {
  const arr = new Uint8Array(vec.size());
  for (let i = 0; i < arr.length; ++i) {
    arr[i] = vec.get(i);
  }
  return arr;
}

export class ZdepthApi {
  private _module: EmscriptenModule | undefined;
  private _compressor: EmbindDepthCompressor | undefined;

  /**
   * Initializes the WebAssembly module. This method must be called once
   * before any other compression or decompression operations.
   * It handles the asynchronous loading of the .wasm file.
   *
   * @returns A Promise that resolves when the module is fully loaded and ready.
   * @throws {ZdepthWASMError} if the module fails to load or initialize.
   */
  public async init(): Promise<void> {
    if (this._module) {
      console.warn(
        "Zdepth WASM module already initialized. Skipping re-initialization."
      );
      return;
    }

    try {
      this._module = await ZdepthModuleFactory();
      this._compressor = new this._module.DepthCompressor();

      console.log("Zdepth WASM module initialized successfully.");
    } catch (e: any) {
      console.error("Failed to initialize Zdepth WASM module:", e);
      throw new ZdepthWASMError(
        `Failed to load or initialize WebAssembly module. Details: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  /**
   * Internal helper to ensure the module is initialized before performing operations.
   * @throws {ZdepthWASMError} if the module has not been initialized.
   */
  private _ensureInitialized(): void {
    if (!this._module || !this._compressor) {
      throw new ZdepthWASMError(
        "Zdepth WASM module not initialized. Call init() before using compression/decompression methods."
      );
    }
  }

  /**
   * Compresses a depth image using the underlying C++ Zdepth library.
   *
   * @param width The width of the depth image (must be a multiple of kBlockSize, e.g., 32).
   * @param height The height of the depth image (must be a multiple of kBlockSize, e.g., 32).
   * @param unquantizedDepth A `Uint16Array` containing the raw 16-bit depth data.
   * @param keyframe A boolean indicating if this is a keyframe (true) or a P-frame (false).
   * @returns A `Uint8Array` containing the compressed depth data.
   * @throws {ZdepthWASMError} if the compression operation fails in the C++ layer.
   */
  public compress(
    width: number,
    height: number,
    unquantizedDepth: Uint16Array,
    keyframe: boolean
  ): Uint8Array {
    this._ensureInitialized();
    try {
      const vecDepth = toVectorUint16(this._module, unquantizedDepth);
      const result = this._compressor!.compress(
        width,
        height,
        vecDepth,
        keyframe
      );
      const compressed = fromVectorUint8(result.compressed_data);
      vecDepth.delete();
      result.compressed_data.delete();
      return compressed;
    } catch (e: any) {
      const errorCode =
        typeof e.message === "string" ? parseInt(e.message, 10) : undefined;
      const errorMessage = getDepthResultErrorMessage(errorCode || -1);
      throw new ZdepthWASMError(
        `Compression failed: ${errorMessage}`,
        errorCode
      );
    }
  }

  /**
   * Decompresses a depth image using the underlying C++ Zdepth library.
   *
   * @param compressedData A `Uint8Array` containing the compressed depth data.
   * @returns An object with `width`, `height` (numbers), and `data` (a `Uint16Array`)
   * representing the decompressed depth image.
   * @throws {ZdepthWASMError} if the decompression operation fails in the C++ layer.
   */
  public decompress(compressedData: Uint8Array): {
    width: number;
    height: number;
    data: Uint16Array;
  } {
    this._ensureInitialized();
    try {
      const vecCompressed = toVectorUint8(this._module, compressedData);
      const result = this._compressor!.decompress(vecCompressed);
      const data = fromVectorUint16(result.depth_data);
      const width = result.width;
      const height = result.height;
      vecCompressed.delete();
      result.depth_data.delete();
      return { width, height, data };
    } catch (e: any) {
      const errorCode =
        typeof e.message === "string" ? parseInt(e.message, 10) : undefined;
      const errorMessage = getDepthResultErrorMessage(errorCode || -1);
      throw new ZdepthWASMError(
        `Decompression failed: ${errorMessage}`,
        errorCode
      );
    }
  }
}
