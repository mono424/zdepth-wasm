# Zdepth WASM

A WebAssembly (WASM) port of the Zdepth C++ library for efficient, lossless compression and decompression of depth images. Zdepth is optimized for depth data from devices like the Azure Kinect DK, leveraging Zstd compression and temporal prediction.

This repository provides:

- The core Zdepth C++ library.
- A WASM build of Zdepth, exposed via Emscripten and a TypeScript API wrapper.
- An example web application (using Solid.js) demonstrating how to use the WASM module for compressing and decompressing depth data, including TIFF file parsing for input.

## Features

- Lossless depth image compression.
- Optimized for Azure Kinect DK sensor data.
- Utilizes Zstd for efficient compression.
- Supports temporal prediction for improved compression ratios on sequential frames (P-frames).
- Provides a convenient TypeScript API for easy integration into web projects.

## Installation

```bash
# Clone the repository
git clone [YOUR_REPO_URL]
cd zdepth-wasm

# Install dependencies (for the example and build scripts)
npm install
```

## Building

To build the WebAssembly module and the TypeScript API wrapper:

```bash
npm run build
```

This command will:

1.  Clean the `build` directory.
2.  Compile the C++ and C (Zstd) sources into a `.wasm` file and JavaScript glue code using Emscripten, outputting to `build/wasm_modules/`.
3.  Compile the TypeScript API wrapper (`src/zdepthApi.ts`) into JavaScript and generate TypeScript declaration files (`.d.ts`) in the `build` directory.

## Usage (TypeScript/JavaScript)

First, install the package in your project:

```bash
npm install ./path/to/zdepth-wasm/build
# or if published to npm:
npm install zdepth-wasm
```

Then, in your JavaScript/TypeScript code:

```typescript
import { ZdepthApi, DepthResult } from "zdepth-wasm"; // Adjust path if installed differently

async function runZdepthExample() {
  const zdepth = new ZdepthApi();

  try {
    // 1. Initialize the WASM module
    await zdepth.init();
    console.log("Zdepth WASM initialized.");

    // Example depth data (replace with your actual data)
    const width = 640;
    const height = 480;
    const unquantizedDepth = new Uint16Array(width * height).map(
      (_, i) => (i % 1000) + 200
    ); // Dummy data

    // 2. Compress the depth data
    console.log(`Original data size: ${unquantizedDepth.length * 2} bytes`);
    const compressedData = zdepth.compress(
      width,
      height,
      unquantizedDepth,
      true
    ); // true for keyframe
    console.log(`Compressed data size: ${compressedData.length} bytes`);

    // 3. Decompress the data
    const decompressedResult = zdepth.decompress(compressedData);
    console.log(
      `Decompressed data dimensions: ${decompressedResult.width}x${decompressedResult.height}`
    );
    console.log(
      `Decompressed data size: ${decompressedResult.data.length * 2} bytes`
    );

    // Verify (optional)
    for (let i = 0; i < unquantizedDepth.length; i++) {
      if (unquantizedDepth[i] !== decompressedResult.data[i]) {
        console.error("Data mismatch after decompression at index", i);
        break;
      }
    }
    console.log("Compression and decompression successful!");
  } catch (error) {
    if (error instanceof ZdepthWASMError) {
      console.error(`Zdepth Error [Code: ${error.code}]: ${error.message}`);
    } else {
      console.error("An unexpected error occurred:", error);
    }
  }
}

runZdepthExample();
```

## Development (Example App)

To run the Solid.js example application:

```bash
npm start --workspace example
```

This will start a development server, usually at `http://localhost:3000`, where you can test the compression/decompression in your browser.

## Project Structure

- `zdepth/`: The original Zdepth C++ library and its Zstd dependency.
- `zdepth_wasm/`: Emscripten-specific C++ source code for the WASM bindings.
- `src/`: TypeScript API wrapper (`zdepthApi.ts`) that interacts with the WASM module.
- `build/`: Output directory for compiled WASM modules and TypeScript files.
- `example/`: A Solid.js application demonstrating the library's usage.
- `scripts/`: Build scripts (like `build.ts`) for automating the compilation process.
